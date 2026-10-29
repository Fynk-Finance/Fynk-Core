// Copy of the onboarding module (Spanish, Colombia), from docs/design/sources/light/Onb*.html.
import type { StepId } from '../domain/steps';

export const onboardingStrings = {
  intro: {
    // "5 pasos" in the design: the email step was removed (ADR 0007).
    steps: (n: number) => `${n} pasos`,
    minutes: '3 minutos',
    title: 'Configuremos tu cuenta',
    text: 'Te guiaremos paso a paso para dejar Fynk listo para ti.',
    start: 'Comenzar configuración',
    skip: 'Omitir por ahora',
    illustration: 'Ilustración: lista de pasos de configuración con tarjeta, meta y monedas',
  },
  step: {
    back: 'Volver al paso anterior',
    continue: 'Continuar',
    finish: 'Terminar configuración',
  },
  steps: {
    name: { title: '¿Cómo te llamamos?', subtitle: 'Así te saludaremos cada vez que entres.' },
    accounts: {
      title: 'Agrega tus cuentas',
      subtitle: 'Conecta tus bancos y registra tu efectivo.',
    },
    goals: {
      title: 'Crea tus metas',
      subtitle: 'Ponle nombre a eso por lo que estás ahorrando.',
    },
    recurring: {
      title: 'Gastos recurrentes',
      subtitle: 'Arriendo, servicios, suscripciones… todo lo que pagas cada mes.',
    },
  } satisfies Record<StepId, { title: string; subtitle: string }>,
  name: {
    label: 'Nombre',
    placeholder: 'Tu nombre',
    hint: 'Puedes cambiarlo cuando quieras desde Mi cuenta.',
    hello: 'Hola,',
    // Not in the design: new, needs design review.
    errors: {
      invalid: 'Escribe solo letras. También puedes usar espacios, guiones, apóstrofos y puntos.',
      tooLong: 'El nombre y el apellido pueden tener hasta 50 letras cada uno.',
      notSaved: 'No pudimos guardar tu nombre. Revisa tu conexión e intenta de nuevo.',
    },
  },
  // Steps whose content another module still has to build (not in the design).
  placeholder: {
    comingSoon: 'Paso en construcción',
    builtBy: (owner: string) => `Lo construye el módulo ${owner}.`,
  },
  skip: {
    back: 'Volver a la configuración',
    title: '¿Seguro que quieres omitir la configuración?',
    text: 'Sin estos datos, Fynk no podrá mostrarte información útil sobre tu dinero.',
    pendingTitle: 'Quedará pendiente:',
    // The design's fourth item, "Recuperar tu cuenta con tu correo", left with the email step.
    pending: {
      balance: 'Un balance real de todo tu dinero',
      goals: 'Seguimiento de tus metas de ahorro',
      reminders: 'Recordatorios antes de cada pago',
    },
    // The design writes "despues" without the accent.
    later: 'Puedes configurarlo después en la aplicación',
    keepGoing: 'Seguir configurando',
    skipAnyway: 'Omitir de todos modos',
  },
} as const;
