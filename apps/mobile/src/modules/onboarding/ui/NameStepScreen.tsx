// Step 1 · Nombre (OnbNombre): the avatar with the initials of what is typed, "Hola, <name>!",
// one name field and the hint. "Continuar" is enabled only for a name PATCH /me accepts; it
// saves the name first (the first word as the first name, the rest as the last name), then
// opens the next step. The field starts with the saved name, if there is one.
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { isApiError } from '@shared/api';
import { AppText, Avatar, TextField, radius, useThemedStyles, type Theme } from '@shared/ui';

import type { NamePort } from '../application/ports';
import { greetingName, joinName, nameProblem, splitFullName } from '../domain/name';
import { StepLayout } from './StepLayout';
import { onboardingStrings } from './strings.es-CO';
import { useStepActions } from './useStepActions';

const copy = onboardingStrings.name;
const AVATAR = 88;
const RING = 5;

export function createNameStep(names: NamePort) {
  return function NameStepScreen() {
    const styles = useThemedStyles(createStyles);
    const actions = useStepActions('name');
    const [text, setText] = useState('');
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    // Fill the field with the saved name, unless the person already typed something.
    useEffect(() => {
      let active = true;
      names
        .getName()
        .then((saved) => {
          if (active) setText((current) => current || joinName(saved));
        })
        .catch(() => undefined);
      return () => {
        active = false;
      };
    }, []);

    const problem = nameProblem(text);
    const typedProblem =
      problem === 'invalid' || problem === 'tooLong' ? copy.errors[problem] : undefined;
    const greeting = greetingName(text);

    const save = async () => {
      const name = splitFullName(text);
      if (!name || problem || saving) return;
      setSaving(true);
      setSaveError(null);
      try {
        await names.saveName(name);
      } catch (error) {
        setSaveError(
          isApiError(error) && error.code === 'invalid_profile'
            ? copy.errors.invalid
            : copy.errors.notSaved,
        );
        setSaving(false);
        return;
      }
      setSaving(false);
      await actions.complete();
    };

    return (
      <StepLayout
        step="name"
        actions={actions}
        canContinue={problem === null}
        onContinue={() => void save()}
        busy={saving}
      >
        <View style={styles.hello}>
          <View style={styles.ring}>
            <Avatar name={text.trim()} size={AVATAR} />
          </View>
          {greeting ? (
            <AppText variant="small" color="textSecondary" testID="onboarding.name.greeting">
              {`${copy.hello} `}
              <AppText variant="smallStrong">{greeting}</AppText>!
            </AppText>
          ) : null}
        </View>
        <TextField
          label={copy.label}
          icon="user"
          value={text}
          onChangeText={(value) => {
            setText(value);
            setSaveError(null);
          }}
          placeholder={copy.placeholder}
          autoComplete="name"
          textContentType="name"
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={() => void save()}
          error={saveError ?? typedProblem}
          helper={copy.hint}
          testID="onboarding.name.field"
        />
      </StepLayout>
    );
  };
}

const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    hello: { alignItems: 'center', gap: 8, paddingVertical: 4 },
    // The 5 px ring of the design (`box-shadow: 0 0 0 5px`), in the theme's soft blue.
    ring: {
      padding: RING,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceBlue,
    },
  });
