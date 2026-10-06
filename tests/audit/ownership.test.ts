import { describe, expect, it } from 'vitest'
import extension from '../../extension.config'

describe('translation storage ownership', () => {
  it('creates no extension tables; configuration uses host-owned agency and stream storage', () => {
    expect(extension.migrations).toBeUndefined()
    expect(extension.auditOwnership).toEqual([])
    expect(extension.requiredHostCapabilities).toContain('audit-ownership')
  })
})
