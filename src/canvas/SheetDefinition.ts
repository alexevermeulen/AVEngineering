export type SheetDefinition = {
  id: string
  name: string
  title: string
  revision: string
}

export const MAIN_SHEET: SheetDefinition = {
  id: 'main',
  name: 'Main',
  title: 'Engineering Drawing',
  revision: '01',
}

export const DEFAULT_SHEETS: SheetDefinition[] = [
  MAIN_SHEET,
  {
    id: 'video',
    name: 'Video',
    title: 'Video Engineering',
    revision: '01',
  },
  {
    id: 'audio',
    name: 'Audio',
    title: 'Audio Engineering',
    revision: '01',
  },
  {
    id: 'network',
    name: 'Network',
    title: 'Network Engineering',
    revision: '01',
  },
]