import type { LensId } from '@day15/shared/lenses'

import agency from '../../../../persona-harnesses/personas/agency.md'
import cfo from '../../../../persona-harnesses/personas/cfo.md'
import client from '../../../../persona-harnesses/personas/client.md'
import delivery from '../../../../persona-harnesses/personas/delivery.md'
import procurement from '../../../../persona-harnesses/personas/procurement.md'
import wrapper from '../../../../persona-harnesses/wrapper.md'

/** Each persona's Actor, Instructions and Mission, straight from its markdown file. `cto` is the delivery persona. */
export const PERSONAS: Record<LensId, string> = { cfo, cto: delivery, agency, client, procurement }

/** The shared wrapper every lens runs inside, with its `{{slot}}` placeholders still in. */
export const WRAPPER = wrapper

/** Fills `{{name}}` slots in a template, leaving any slot without a value as it was. */
export function fillSlots(template: string, slots: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (slot, name: string) => slots[name] ?? slot)
}
