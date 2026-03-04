import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Linking,
} from "react-native";
import { Spacing, Radius, FontSize, FontWeight, LineHeight, type ColorTokens } from "../../src/ui/tokens";
import { useThemedStyles } from "@/src/ui/ThemeProvider";

const PRIVACY_POLICY_URL = "https://ccraig09.github.io/money-shepherd-domain/privacy.html";
const PLAID_PRIVACY_URL = "https://plaid.com/legal/#end-user-privacy-policy";
const CONTACT_EMAIL = "support@moneyshepherd.app";

export default function PrivacyScreen() {
  const styles = useThemedStyles(createStyles);

  function openURL(url: string) {
    Linking.openURL(url);
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.container}>
      <Text style={styles.pageTitle}>Privacy & Data</Text>
      <Text style={styles.pageSubtitle}>
        How Money Shepherd collects, uses, and protects your financial data.
      </Text>

      {/* Privacy Policy */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Privacy Policy</Text>
        <Text style={styles.bodyText}>
          Money Shepherd is a personal budgeting app. We collect only what is necessary to power your envelope budget:
        </Text>
        <BulletItem text="Bank account balances and transactions (via Plaid)" />
        <BulletItem text="Your budget data: envelopes, allocations, and assignments" />
        <BulletItem text="An anonymous session ID for optional multi-device sync" />
        <Text style={styles.bodyText}>
          We do not sell, share, or use your financial data for advertising or profiling. Your bank credentials are never seen by us — Plaid handles authentication directly with your institution.
        </Text>
        <LinkButton
          label="View Full Privacy Policy"
          onPress={() => openURL(PRIVACY_POLICY_URL)}
          styles={styles}
        />
      </View>

      {/* Data Retention */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Data Retention</Text>
        <BulletItem text="On-device data is kept until you delete the app or use Clear All Data in Settings." />
        <BulletItem text="Cloud-synced data (if sync is enabled) is stored in Firebase and linked to your anonymous session." />
        <BulletItem text="Plaid connection tokens are stored securely in your device's Keychain." />
        <BulletItem text="If you disconnect a bank, your Plaid access is revoked server-side immediately." />
      </View>

      {/* Third-party Services */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Third-Party Services</Text>
        <Text style={styles.bodyText}>
          Money Shepherd uses the following services to provide core functionality:
        </Text>
        <View style={styles.serviceRow}>
          <View style={styles.serviceInfo}>
            <Text style={styles.serviceName}>Plaid</Text>
            <Text style={styles.serviceDesc}>Secure bank connection and transaction retrieval</Text>
          </View>
          <Pressable onPress={() => openURL(PLAID_PRIVACY_URL)} hitSlop={8}>
            <Text style={styles.link}>Privacy Policy →</Text>
          </Pressable>
        </View>
        <View style={styles.divider} />
        <View style={styles.serviceRow}>
          <View style={styles.serviceInfo}>
            <Text style={styles.serviceName}>Google Firebase</Text>
            <Text style={styles.serviceDesc}>Anonymous authentication and optional cloud sync</Text>
          </View>
        </View>
      </View>

      {/* Data Deletion */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Delete Your Data</Text>
        <Text style={styles.bodyText}>You can delete your data at any time:</Text>
        <BulletItem text='Local data: Settings → "Reset Local Storage"' />
        <BulletItem text="Cloud data: cleared automatically when you reset local storage" />
        <BulletItem text='Plaid connection: Settings → Bank Connections → "Remove"' />
        <Text style={styles.bodyText}>
          To request manual data deletion or ask a privacy question, contact us:
        </Text>
        <Pressable onPress={() => openURL(`mailto:${CONTACT_EMAIL}`)} hitSlop={8}>
          <Text style={styles.link}>{CONTACT_EMAIL}</Text>
        </Pressable>
      </View>

      <Text style={styles.footerText}>
        Last updated: March 4, 2026 · CRAIG DEVELOPMENT LLC
      </Text>
    </ScrollView>
  );
}

function BulletItem({ text }: { text: string }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bullet}>•</Text>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

function LinkButton({
  label,
  onPress,
  styles,
}: {
  label: string;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.linkBtn, pressed && styles.linkBtnPressed]}
      hitSlop={8}
    >
      <Text style={styles.linkBtnText}>{label} →</Text>
    </Pressable>
  );
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.surfaceLight },
  container: { padding: Spacing.base, gap: Spacing.base, paddingBottom: Spacing.bottomPad },
  pageTitle: { fontSize: FontSize.title, fontWeight: FontWeight.extrabold, color: c.textDark, marginTop: Spacing.sm },
  pageSubtitle: { fontSize: FontSize.body, color: c.textMid, lineHeight: LineHeight.body, marginBottom: Spacing.xs },
  card: {
    backgroundColor: c.surface,
    borderRadius: Radius.hero,
    padding: Spacing.base,
    gap: Spacing.sm,
    shadowColor: c.shadowColor,
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  cardTitle: {
    fontSize: FontSize.caption,
    fontWeight: FontWeight.semibold,
    color: c.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
  },
  bodyText: {
    fontSize: FontSize.body,
    color: c.textMid,
    lineHeight: LineHeight.body,
  },
  bulletRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingLeft: Spacing.xs,
  },
  bullet: {
    fontSize: FontSize.body,
    color: c.primary,
    lineHeight: LineHeight.body,
  },
  bulletText: {
    flex: 1,
    fontSize: FontSize.small,
    color: c.textMid,
    lineHeight: LineHeight.small,
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: c.borderLight },
  serviceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: Spacing.sm,
  },
  serviceInfo: { flex: 1 },
  serviceName: { fontSize: FontSize.body, fontWeight: FontWeight.semibold, color: c.textDark },
  serviceDesc: { fontSize: FontSize.small, color: c.textMuted, marginTop: 2 },
  link: {
    fontSize: FontSize.small,
    color: c.primary,
    fontWeight: FontWeight.semibold,
  },
  linkBtn: {
    paddingVertical: Spacing.sm,
    marginTop: Spacing.xs,
  },
  linkBtnPressed: { opacity: 0.6 },
  linkBtnText: {
    fontSize: FontSize.body,
    color: c.primary,
    fontWeight: FontWeight.semibold,
  },
  footerText: {
    fontSize: FontSize.caption,
    color: c.textSubtle,
    textAlign: "center",
    paddingVertical: Spacing.sm,
  },
});
