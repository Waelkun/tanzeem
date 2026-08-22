import { describe, it, expect } from 'vitest'
import { fmtDuration, fmtDurationAr, fmtHours } from './dates'

describe('fmtDuration (HH:MM:SS / MM:SS)', () => {
  it('shows MM:SS under an hour', () => {
    expect(fmtDuration(0)).toBe('00:00')
    expect(fmtDuration(65)).toBe('01:05')
    expect(fmtDuration(599)).toBe('09:59')
  })
  it('shows HH:MM:SS at or over an hour', () => {
    expect(fmtDuration(3600)).toBe('01:00:00')
    expect(fmtDuration(3661)).toBe('01:01:01')
  })
  it('clamps negatives to zero', () => {
    expect(fmtDuration(-5)).toBe('00:00')
  })
})

describe('fmtDurationAr (precise, never rounds away short work)', () => {
  it('renders seconds for sub-minute durations', () => {
    expect(fmtDurationAr(0)).toBe('0 ث')
    expect(fmtDurationAr(10)).toBe('10 ث')
  })
  it('renders minutes and seconds under an hour', () => {
    expect(fmtDurationAr(90)).toBe('1 د 30 ث')
    expect(fmtDurationAr(600)).toBe('10 د')
  })
  it('drops seconds once an hour is reached', () => {
    expect(fmtDurationAr(3600)).toBe('1 س')
    expect(fmtDurationAr(3661)).toBe('1 س 1 د')
    expect(fmtDurationAr(7260)).toBe('2 س 1 د')
  })
})

describe('fmtHours', () => {
  it('rounds to one decimal with the Arabic hour suffix', () => {
    expect(fmtHours(0)).toBe('0 س')
    expect(fmtHours(12.54)).toBe('12.5 س')
    expect(fmtHours(0.05)).toBe('0.1 س')
  })
})
