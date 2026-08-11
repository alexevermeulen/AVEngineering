import type { Signal } from '../types'

export type SheetDefinition = {
  id: string
  name: string
  title: string
  revision: string

  /**
   * null = alle signalen/poorten tonen.
   * Een lijst = alleen deze signalen tonen.
   */
  signals: Signal[] | null
}

export const MAIN_SHEET: SheetDefinition = {
  id: 'main',
  name: 'Main',
  title: 'Engineering Drawing',
  revision: '01',
  signals: null,
}

export const DEFAULT_SHEETS: SheetDefinition[] = [
  MAIN_SHEET,

  {
    id: 'video',
    name: 'Video',
    title: 'Video Engineering',
    revision: '01',
    signals: ['DGV'],
  },

  {
    id: 'audio',
    name: 'Audio',
    title: 'Audio Engineering',
    revision: '01',
    signals: ['AUD'],
  },

  {
    id: 'network',
    name: 'Network',
    title: 'Network Engineering',
    revision: '01',
    signals: ['DAT'],
  },
]