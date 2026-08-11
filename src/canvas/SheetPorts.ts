import type { DeviceType, Port } from '../types'
import type { SheetDefinition } from './SheetDefinition'

export function getPortsForSheet(
  deviceType: DeviceType,
  sheet: SheetDefinition,
): Port[] {
  if (sheet.signals === null) {
    return deviceType.ports
  }

  return deviceType.ports.filter((port) =>
    sheet.signals?.includes(port.signal),
  )
}