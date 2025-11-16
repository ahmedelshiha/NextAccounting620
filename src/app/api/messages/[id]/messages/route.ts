/**
 * Messages API - Send Message
 * POST /api/messages/[id]/messages - Send a message in a thread
 */

import { NextRequest, NextResponse } from "next/server";
import { withTenantContext } from "@/lib/api-wrapper";
import { requireTenantContext } from "@/lib/tenant-utils";
import { MessagesService } from "@/lib/services/messages/messages-service";
import { z } from "zod";

const sendMessageSchema = z.object({
  text: z.string().min(1, "Message text is required").max(5000),
  attachments: z.array(z.string()).optional(),
});

export const POST = withTenantContext(async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  try {
    // Authentication
    const ctx = requireTenantContext();
    if (!ctx.userId || !ctx.tenantId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const tenantId = ctx.tenantId;
    const userId = ctx.userId;
    const userName = ctx.userName || "";
    const userRole = ctx.role || "CLIENT";
    const threadId = params.id;

    // Parse and validate request body
    const body = await request.json();
    const validation = sendMessageSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation error",
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const { text } = validation.data;

    // Send message
    const message = await MessagesService.sendMessage(
      tenantId,
      userId,
      userName,
      userRole,
      threadId,
      text
    );

    return NextResponse.json({
      success: true,
      data: message,
      message: "Message sent successfully",
    });
  } catch (error: any) {
    console.error("Error sending message:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to send message",
        details: error.message,
      },
      { status: 500 }
    );
  }
});
