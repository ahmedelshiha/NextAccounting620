import { describe, it, expect } from 'vitest'
import {
  getCountry,
  getAllCountries,
  validateIdentifier,
  getObligations,
  getEconomicZone,
  getEconomicZones,
  calculateFilingDueDate,
  UAE,
  KSA,
  EGYPT,
  type CountryCode,
} from '../countries'

describe('Country Registry', () => {
  describe('Country Configuration', () => {
    it('should have UAE configuration', () => {
      expect(UAE.code).toBe('AE')
      expect(UAE.name).toBe('United Arab Emirates')
      expect(UAE.currency).toBe('AED')
      expect(UAE.taxRate).toBe(0.05)
    })

    it('should have KSA configuration', () => {
      expect(KSA.code).toBe('SA')
      expect(KSA.name).toBe('Saudi Arabia')
      expect(KSA.currency).toBe('SAR')
      expect(KSA.taxRate).toBe(0.15)
      expect(KSA.zakatRate).toBe(0.025)
    })

    it('should have Egypt configuration', () => {
      expect(EGYPT.code).toBe('EG')
      expect(EGYPT.name).toBe('Egypt')
      expect(EGYPT.currency).toBe('EGP')
      expect(EGYPT.taxRate).toBe(0.14)
    })

    it('should have Arabic names for all countries', () => {
      expect(UAE.nameAr).toBe('الإمارات العربية المتحدة')
      expect(KSA.nameAr).toBe('المملكة العربية السعودية')
      expect(EGYPT.nameAr).toBe('مصر')
    })
  })

  describe('getCountry function', () => {
    it('should return UAE config for AE code', () => {
      const country = getCountry('AE')
      expect(country?.code).toBe('AE')
      expect(country?.name).toBe('United Arab Emirates')
    })

    it('should return KSA config for SA code', () => {
      const country = getCountry('SA')
      expect(country?.code).toBe('SA')
    })

    it('should return Egypt config for EG code', () => {
      const country = getCountry('EG')
      expect(country?.code).toBe('EG')
    })

    it('should return undefined for invalid country code', () => {
      const country = getCountry('XX' as CountryCode)
      expect(country).toBeUndefined()
    })
  })

  describe('getAllCountries function', () => {
    it('should return all three countries', () => {
      const countries = getAllCountries()
      expect(countries).toHaveLength(3)
      expect(countries.map((c) => c.code)).toEqual(['AE', 'SA', 'EG'])
    })
  })

  describe('TRN Validation (UAE)', () => {
    it('should validate correct UAE TRN format', () => {
      const isValid = validateIdentifier('AE', 'TRN', '100067144000097')
      expect(isValid).toBe(true)
    })

    it('should reject TRN with wrong length', () => {
      const isValid = validateIdentifier('AE', 'TRN', '10006714400009')
      expect(isValid).toBe(false)
    })

    it('should reject TRN with non-numeric characters', () => {
      const isValid = validateIdentifier('AE', 'TRN', '10006714400009A')
      expect(isValid).toBe(false)
    })

    it('should validate any 15-digit TRN format', () => {
      const isValid = validateIdentifier('AE', 'TRN', '100067144000000')
      expect(isValid).toBe(true)
    })
  })

  describe('License Validation (UAE)', () => {
    it('should validate correct UAE license format', () => {
      const isValid = validateIdentifier('AE', 'LICENSE', 'P123456A')
      expect(isValid).toBe(true)
    })

    it('should reject license with wrong format', () => {
      const isValid = validateIdentifier('AE', 'LICENSE', 'P12345A')
      expect(isValid).toBe(false)
    })

    it('should reject license with lowercase letters', () => {
      const isValid = validateIdentifier('AE', 'LICENSE', 'p123456A')
      expect(isValid).toBe(false)
    })
  })

  describe('CR Validation (KSA)', () => {
    it('should validate correct KSA CR format', () => {
      const isValid = validateIdentifier('SA', 'CR', '1234567890')
      expect(isValid).toBe(true)
    })

    it('should reject CR with wrong length', () => {
      const isValid = validateIdentifier('SA', 'CR', '123456789')
      expect(isValid).toBe(false)
    })

    it('should reject CR with non-numeric characters', () => {
      const isValid = validateIdentifier('SA', 'CR', '123456789A')
      expect(isValid).toBe(false)
    })
  })

  describe('VAT Registration Validation (KSA)', () => {
    it('should validate correct KSA VAT format', () => {
      const isValid = validateIdentifier('SA', 'VAT', '310000000000001')
      expect(isValid).toBe(true)
    })

    it('should reject VAT with wrong length', () => {
      const isValid = validateIdentifier('SA', 'VAT', '31000000000000')
      expect(isValid).toBe(false)
    })
  })

  describe('TIN Validation (Egypt)', () => {
    it('should validate correct Egyptian TIN format', () => {
      const isValid = validateIdentifier('EG', 'TIN', '123456789')
      expect(isValid).toBe(true)
    })

    it('should reject TIN with wrong length', () => {
      const isValid = validateIdentifier('EG', 'TIN', '12345678')
      expect(isValid).toBe(false)
    })

    it('should reject TIN with non-numeric characters', () => {
      const isValid = validateIdentifier('EG', 'TIN', '12345678A')
      expect(isValid).toBe(false)
    })
  })

  describe('Economic Zones', () => {
    it('should have multiple economic zones for UAE', () => {
      const zones = getEconomicZones('AE')
      expect(zones.length).toBeGreaterThan(0)
      expect(zones.map((z) => z.country)).toEqual(
        Array(zones.length).fill('AE')
      )
    })

    it('should have economic zones for KSA', () => {
      const zones = getEconomicZones('SA')
      expect(zones.length).toBeGreaterThan(0)
    })

    it('should have economic zones for Egypt', () => {
      const zones = getEconomicZones('EG')
      expect(zones.length).toBeGreaterThan(0)
    })

    it('should retrieve specific economic zone', () => {
      const zone = getEconomicZone('AE', 'ae-ded')
      expect(zone?.code).toBe('DED')
      expect(zone?.country).toBe('AE')
    })

    it('should return undefined for non-existent zone', () => {
      const zone = getEconomicZone('AE', 'non-existent')
      expect(zone).toBeUndefined()
    })

    it('should include Arabic names for economic zones', () => {
      const zones = getEconomicZones('AE')
      expect(zones.every((z) => z.nameAr)).toBe(true)
    })
  })

  describe('Tax Obligations', () => {
    it('should have VAT obligation for all countries', () => {
      const uaeVat = getObligations('AE').find((o) => o.type === 'VAT')
      const ksaVat = getObligations('SA').find((o) => o.type === 'VAT')
      const egyptVat = getObligations('EG').find((o) => o.type === 'VAT')

      expect(uaeVat).toBeDefined()
      expect(ksaVat).toBeDefined()
      expect(egyptVat).toBeDefined()
    })

    it('should have ESR obligation for UAE', () => {
      const esr = getObligations('AE').find((o) => o.type === 'ESR')
      expect(esr).toBeDefined()
      expect(esr?.frequency).toBe('ANNUALLY')
    })

    it('should have Zakat obligation for KSA', () => {
      const zakat = getObligations('SA').find((o) => o.type === 'ZAKAT')
      expect(zakat).toBeDefined()
    })

    it('should have E-Invoicing obligation for Egypt', () => {
      const einvoice = getObligations('EG').find((o) => o.type === 'E_INVOICE')
      expect(einvoice).toBeDefined()
    })

    it('should filter obligations by entity type', () => {
      const companyObligations = getObligations('AE', 'Company')
      const allObligations = getObligations('AE')
      expect(companyObligations.length).toBeGreaterThan(0)
      expect(companyObligations.length).toBeLessThanOrEqual(
        allObligations.length
      )
    })

    it('should have Arabic names for all obligations', () => {
      const allCountries = getAllCountries()
      allCountries.forEach((country) => {
        country.obligations.forEach((obligation) => {
          expect(obligation.nameAr).toBeDefined()
          expect(obligation.nameAr.length).toBeGreaterThan(0)
        })
      })
    })
  })

  describe('Filing Due Date Calculation', () => {
    it('should calculate VAT filing date for UAE (monthly)', () => {
      const obligation = getObligations('AE').find((o) => o.type === 'VAT')!
      const periodEnd = new Date('2024-01-31')
      const dueDate = calculateFilingDueDate(obligation, periodEnd)
      expect(dueDate).toEqual(new Date('2024-02-28'))
    })

    it('should calculate VAT filing date for KSA (monthly)', () => {
      const obligation = getObligations('SA').find((o) => o.type === 'VAT')!
      const periodEnd = new Date('2024-01-31')
      const dueDate = calculateFilingDueDate(obligation, periodEnd)
      expect(dueDate).toEqual(new Date('2024-02-25'))
    })

    it('should calculate Zakat filing date for KSA (annually)', () => {
      const obligation = getObligations('SA').find((o) => o.type === 'ZAKAT')!
      const periodEnd = new Date('2024-12-31')
      const dueDate = calculateFilingDueDate(obligation, periodEnd)
      expect(dueDate).toEqual(new Date('2025-03-31'))
    })

    it('should calculate ESR filing date for UAE', () => {
      const obligation = getObligations('AE').find((o) => o.type === 'ESR')!
      const periodEnd = new Date('2024-12-31')
      const dueDate = calculateFilingDueDate(obligation, periodEnd)
      expect(dueDate).toEqual(new Date('2025-12-31'))
    })
  })

  describe('Currency and Formatting', () => {
    it('should have correct currency codes', () => {
      expect(UAE.currency).toBe('AED')
      expect(KSA.currency).toBe('SAR')
      expect(EGYPT.currency).toBe('EGP')
    })

    it('should have correct timezones', () => {
      expect(UAE.timezone).toBe('Asia/Dubai')
      expect(KSA.timezone).toBe('Asia/Riyadh')
      expect(EGYPT.timezone).toBe('Africa/Cairo')
    })

    it('should have correct locale information', () => {
      expect(UAE.locale).toBe('en-AE')
      expect(UAE.localeAr).toBe('ar-AE')
      expect(KSA.localeAr).toBe('ar-SA')
      expect(EGYPT.localeAr).toBe('ar-EG')
    })
  })

  describe('Validators Collection', () => {
    it('should have validators for each country', () => {
      expect(UAE.validators.length).toBeGreaterThan(0)
      expect(KSA.validators.length).toBeGreaterThan(0)
      expect(EGYPT.validators.length).toBeGreaterThan(0)
    })

    it('should have unique validator types per country', () => {
      const uaeTypes = UAE.validators.map((v) => v.type)
      const uniqueTypes = new Set(uaeTypes)
      expect(uaeTypes.length).toBe(uniqueTypes.size)
    })

    it('should have descriptions for all validators', () => {
      const allCountries = getAllCountries()
      allCountries.forEach((country) => {
        country.validators.forEach((validator) => {
          expect(validator.description).toBeDefined()
          expect(validator.description.length).toBeGreaterThan(0)
        })
      })
    })
  })

  describe('Metadata', () => {
    it('should have metadata for compliance flags', () => {
      expect(UAE.metadata?.esrApplicable).toBe(true)
      expect(UAE.metadata?.uboRequired).toBe(true)
      expect(KSA.metadata?.zakatApplicable).toBe(true)
      expect(EGYPT.metadata?.etaApplicable).toBe(true)
    })

    it('should have VAT thresholds', () => {
      expect(UAE.metadata?.automaticVatThreshold).toBe(375000)
    })
  })

  describe('Fiscal Year', () => {
    it('should define fiscal year start and end for all countries', () => {
      const allCountries = getAllCountries()
      allCountries.forEach((country) => {
        expect(country.fiscalYearStart).toBeGreaterThanOrEqual(1)
        expect(country.fiscalYearStart).toBeLessThanOrEqual(12)
        expect(country.fiscalYearEnd).toBeGreaterThanOrEqual(1)
        expect(country.fiscalYearEnd).toBeLessThanOrEqual(12)
      })
    })
  })

  describe('Weekend Configuration', () => {
    it('should have correct weekend days for UAE', () => {
      expect(UAE.weekendDays).toEqual([5, 6]) // Friday, Saturday
    })

    it('should have correct weekend days for KSA', () => {
      expect(KSA.weekendDays).toEqual([4, 5]) // Thursday, Friday
    })

    it('should have correct weekend days for Egypt', () => {
      expect(EGYPT.weekendDays).toEqual([5, 6]) // Friday, Saturday
    })
  })

  describe('Tax Rates', () => {
    it('should have correct VAT rates', () => {
      expect(UAE.taxRate).toBe(0.05)
      expect(KSA.taxRate).toBe(0.15)
      expect(EGYPT.taxRate).toBe(0.14)
    })

    it('should have corporate tax rates where applicable', () => {
      expect(UAE.corporateTaxRate).toBe(0.09)
      expect(KSA.corporateTaxRate).toBeUndefined()
    })

    it('should have Zakat rate for KSA', () => {
      expect(KSA.zakatRate).toBe(0.025)
      expect(UAE.zakatRate).toBeUndefined()
      expect(EGYPT.zakatRate).toBeUndefined()
    })
  })
})
