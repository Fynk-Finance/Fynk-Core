// The system clipboard, for the "Copiar" button of the recovery code.
import { setStringAsync } from 'expo-clipboard';

export const copyText = (text: string): Promise<boolean> => setStringAsync(text);
