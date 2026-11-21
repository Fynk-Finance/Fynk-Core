// Slots let a module show its section on another module's screen without importing that
// module, which can close an import cycle (vault already imports identity, for example).
// The owner of the section registers it from its index.ts; the owner of the screen renders
// <Slot name="…" />. An empty slot renders nothing. Names are listed here once, by M0.
import { createElement, type ComponentType } from 'react';

export type SlotName =
  /** "Mis cuentas" (M6) on Mi cuenta (M1), after "Información Básica". */
  'miCuenta.misCuentas';

const slots = new Map<SlotName, ComponentType>();

/** Called once from the index.ts of the module that owns the section. */
export function registerSlot(name: SlotName, component: ComponentType): void {
  slots.set(name, component);
}

/** Renders the section registered for `name`, or nothing. */
export function Slot({ name }: { name: SlotName }) {
  const section = slots.get(name);
  return section ? createElement(section) : null;
}
