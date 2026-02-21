import { getFunctions, httpsCallable } from "firebase/functions";
import {
  create,
  open,
  LinkLogLevel,
  LinkIOSPresentationStyle,
  type LinkSuccess,
  type LinkExit,
  type LinkTokenConfiguration,
  type LinkOpenProps,
} from "react-native-plaid-link-sdk";
import { getFirebase } from "../firebase/firebaseClient";

const functions = getFunctions(getFirebase().app);

interface CreateLinkTokenResponse {
  linkToken: string;
  expiration: string;
}

/**
 * Calls the Cloud Function to obtain a short-lived Plaid link token.
 * PLAID_SECRET never leaves the server.
 */
export async function requestLinkToken(userId: string): Promise<string> {
  const fn = httpsCallable<{ userId: string }, CreateLinkTokenResponse>(
    functions,
    "createLinkToken"
  );
  const result = await fn({ userId });
  return result.data.linkToken;
}

export interface PlaidLinkCallbacks {
  onSuccess: (publicToken: string, metadata: LinkSuccess["metadata"]) => void;
  onExit: (error: LinkExit["error"] | null) => void;
}

/**
 * Initializes the Plaid Link SDK with the given link token,
 * then opens the Link UI sheet.
 */
export function openPlaidLink(
  linkToken: string,
  callbacks: PlaidLinkCallbacks
): void {
  const tokenConfig: LinkTokenConfiguration = {
    token: linkToken,
    noLoadingState: false,
  };

  create(tokenConfig);

  const openProps: LinkOpenProps = {
    onSuccess: (success: LinkSuccess) => {
      callbacks.onSuccess(
        success.publicToken,
        success.metadata
      );
    },
    onExit: (exit: LinkExit) => {
      callbacks.onExit(exit.error ?? null);
    },
    iOSPresentationStyle: LinkIOSPresentationStyle.MODAL,
    logLevel: LinkLogLevel.ERROR,
  };

  open(openProps);
}
