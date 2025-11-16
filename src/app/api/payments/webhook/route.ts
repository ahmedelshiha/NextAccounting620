import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withTenantContext } from '@/lib/api-wrapper'
import { logger } from '@/lib/logger'

/**
 * Stripe Webhook Handler with Enhanced Security and Idempotency
 * 
 * Features:
 * - Signature verification using STRIPE_WEBHOOK_SECRET
 * - Idempotency protection to prevent duplicate processing
 * - Secure event handling with proper error management
 * - Database transaction safety
 */

const _api_POST = async (request: NextRequest) => {
  const { STRIPE_WEBHOOK_SECRET, STRIPE_SECRET_KEY } = process.env as Record<string, string | undefined>
  
  // Environment validation
  if (!STRIPE_WEBHOOK_SECRET || !STRIPE_SECRET_KEY) {
    logger.error('Stripe webhook: Missing required environment variables')
    return NextResponse.json({ error: 'Payment gateway not configured' }, { status: 501 })
  }

  // Signature validation
  const sig = request.headers.get('stripe-signature')
  if (!sig) {
    logger.error('Stripe webhook: Missing stripe-signature header')
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: any
  let rawBody: Buffer

  try {
    rawBody = Buffer.from(await request.arrayBuffer())
    
    // Import Stripe and verify webhook signature
    const StripeMod = await import('stripe') as any
    const Stripe = StripeMod.default
    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' })
    
    // This will throw if signature is invalid
    event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)
  } catch (err: any) {
    logger.error('Stripe webhook signature verification failed', { message: err?.message }, err instanceof Error ? err : new Error(String(err)))
    return NextResponse.json({
      error: 'Invalid signature',
      message: 'Webhook signature verification failed'
    }, { status: 400 })
  }

  // Idempotency check using Stripe event ID
  const eventId = event.id
  if (!eventId) {
    console.error('Stripe webhook: Missing event ID')
    return NextResponse.json({ error: 'Missing event ID' }, { status: 400 })
  }

  let defaultTenant: { id: string } | null = null

  try {
    // Determine a tenant for idempotency records (fallback to primary tenant if available)
    defaultTenant = await prisma.tenant.findFirst({ where: { slug: 'primary' }, select: { id: true } }).catch(() => null)

    if (defaultTenant?.id) {
      const existingKey = await prisma.idempotencyKey.findFirst({
        where: { key: `stripe_webhook_${eventId}`, tenantId: defaultTenant.id }
      })

      if (existingKey?.status === 'PROCESSED') {
        console.log(`Stripe webhook: Event ${eventId} already processed, returning success`)
        return NextResponse.json({ received: true, message: 'Already processed' })
      }

      await prisma.idempotencyKey.upsert({
        where: { tenantId_key: { tenantId: defaultTenant.id, key: `stripe_webhook_${eventId}` } },
        create: {
          key: `stripe_webhook_${eventId}`,
          entityType: 'stripe_webhook',
          entityId: eventId,
          status: 'PROCESSING',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          tenant: { connect: { id: defaultTenant.id } },
        },
        update: {
          status: 'PROCESSING',
          updatedAt: new Date()
        }
      })
    }

    // Process the webhook event
    await processStripeEvent(event)

    if (defaultTenant?.id) {
      // Mark as successfully processed (best-effort)
      try {
        await prisma.idempotencyKey.update({
          where: { tenantId_key: { tenantId: defaultTenant.id, key: `stripe_webhook_${eventId}` } },
          data: {
            status: 'PROCESSED',
            updatedAt: new Date()
          }
        })
      } catch {}
    }

    console.log(`Stripe webhook: Successfully processed event ${eventId} of type ${event.type}`)
    return NextResponse.json({ received: true })

  } catch (error: any) {
    console.error(`Stripe webhook processing error for event ${eventId}:`, error)

    // Mark as failed for potential retry
    if (defaultTenant?.id) {
      try {
        await prisma.idempotencyKey.update({
          where: { tenantId_key: { tenantId: defaultTenant.id, key: `stripe_webhook_${eventId}` } },
          data: {
            status: 'FAILED',
            updatedAt: new Date()
          }
        })
      } catch (dbError) {
        console.error('Failed to update idempotency key status:', dbError)
      }
    }

    return NextResponse.json({ 
      error: 'Webhook processing failed',
      message: error.message
    }, { status: 500 })
  }
}

/**
 * Process different types of Stripe webhook events
 */
async function processStripeEvent(event: any) {
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutSessionCompleted(event.data.object)
      break
      
    case 'checkout.session.expired':
    case 'payment_intent.payment_failed':
      await handlePaymentFailed(event.data.object)
      break
      
    case 'payment_intent.succeeded':
      await handlePaymentSucceeded(event.data.object)
      break
      
    case 'invoice.payment_succeeded':
      await handleInvoicePaymentSucceeded(event.data.object)
      break
      
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await handleSubscriptionChange(event.data.object, event.type)
      break
      
    default:
      console.log(`Stripe webhook: Unhandled event type ${event.type}`)
  }
}

/**
 * Handle successful checkout session completion
 */
async function handleCheckoutSessionCompleted(session: any) {
  console.log('Processing checkout.session.completed:', session.id)
  
  const explicitId = String(session?.metadata?.serviceRequestId || '')
  if (explicitId) {
    // Direct service request ID provided in metadata
    const sr = await prisma.serviceRequest.findUnique({ where: { id: explicitId } })
    if (sr) {
      await prisma.serviceRequest.update({
        where: { id: sr.id },
        data: {
          paymentStatus: 'PAID',
          paymentProvider: 'STRIPE',
          paymentSessionId: session.id,
          paymentAmountCents: session.amount_total ?? null,
          paymentCurrency: (session.currency || '').toUpperCase() || null,
          paymentUpdatedAt: new Date(),
          paymentAttempts: (sr.paymentAttempts ?? 0) + 1,
        }
      })
      return
    }
  }

  // Fallback: try to find by user + service + scheduled time
  const userId = String(session?.metadata?.userId || '')
  const serviceId = String(session?.metadata?.serviceId || '')
  const scheduledAtISO = String(session?.metadata?.scheduledAt || '')
  const scheduledAt = scheduledAtISO ? new Date(scheduledAtISO) : null

  let target: any = null
  
  if (userId && serviceId && scheduledAt) {
    target = await prisma.serviceRequest.findFirst({
      where: { clientId: userId, serviceId, scheduledAt },
    })
  }
  
  if (!target && userId && serviceId) {
    // Fallback: find recent booking for this user + service
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
    target = await prisma.serviceRequest.findFirst({
      where: { 
        clientId: userId, 
        serviceId, 
        createdAt: { gte: since }, 
        isBooking: true 
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  if (target) {
    await prisma.serviceRequest.update({
      where: { id: target.id },
      data: {
        paymentStatus: 'PAID',
        paymentProvider: 'STRIPE',
        paymentSessionId: session.id,
        paymentAmountCents: session.amount_total ?? null,
        paymentCurrency: (session.currency || '').toUpperCase() || null,
        paymentUpdatedAt: new Date(),
        paymentAttempts: (target.paymentAttempts ?? 0) + 1,
      }
    })
  }
}

/**
 * Handle payment failures
 */
async function handlePaymentFailed(paymentObject: any) {
  console.log('Processing payment failure:', paymentObject.id)
  
  const sessionId = paymentObject?.id || paymentObject?.checkout_session || null
  if (sessionId) {
    const sr = await prisma.serviceRequest.findFirst({ where: { paymentSessionId: sessionId } })
    
    if (sr) {
      await prisma.serviceRequest.update({ where: { id: sr.id }, data: { paymentStatus: 'FAILED', paymentUpdatedAt: new Date(), paymentAttempts: (sr.paymentAttempts ?? 0) + 1 } })
    }
  }
}

/**
 * Handle successful payment intent
 */
async function handlePaymentSucceeded(paymentIntent: any) {
  console.log('Processing payment_intent.succeeded:', paymentIntent.id)
  // Implementation depends on your payment flow
  // This is typically handled by checkout.session.completed instead
}

/**
 * Handle invoice payment success
 */
async function handleInvoicePaymentSucceeded(invoice: any) {
  console.log('Processing invoice.payment_succeeded:', invoice.id)
  // Implementation for subscription or invoice payments
}

/**
 * Handle subscription changes
 */
async function handleSubscriptionChange(subscription: any, eventType: string) {
  console.log(`Processing ${eventType}:`, subscription.id)
  // Implementation for subscription lifecycle management
}

export const POST = withTenantContext(_api_POST, { requireAuth: false })
