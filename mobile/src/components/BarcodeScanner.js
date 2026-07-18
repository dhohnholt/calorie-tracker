import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useTheme, radii } from "../theme";

const PRODUCT_BARCODE_TYPES = ["ean13", "ean8", "upc_a", "upc_e"];

export default function BarcodeScanner({ onScanned, onClose }) {
  const theme = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const scannedRef = useRef(false);

  function handleBarcodeScanned(result) {
    // onBarcodeScanned fires repeatedly while the code stays in frame; only
    // act on the first hit per scanner session.
    if (scannedRef.current) return;
    scannedRef.current = true;
    onScanned(result.data);
  }

  if (!permission) {
    return <View style={[styles.container, { backgroundColor: theme.pagePlane }]} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.pagePlane }]}>
        <Text style={[styles.message, { color: theme.textPrimary }]}>
          Camera access is needed to scan barcodes.
        </Text>
        <Pressable
          style={[styles.button, { backgroundColor: theme.series1 }]}
          onPress={requestPermission}
        >
          <Text style={styles.buttonText}>Allow camera access</Text>
        </Pressable>
        <Pressable style={styles.cancelButton} onPress={onClose}>
          <Text style={{ color: theme.textSecondary, fontWeight: "600" }}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: PRODUCT_BARCODE_TYPES }}
        onBarcodeScanned={handleBarcodeScanned}
      />
      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.frame} />
        <Text style={styles.hint}>Point your camera at a product barcode</Text>
        <Pressable style={[styles.cancelButton, styles.cancelButtonOverlay]} onPress={onClose}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { alignItems: "center", justifyContent: "center", gap: 16, padding: 24 },
  message: { fontSize: 16, textAlign: "center" },
  button: { borderRadius: radii.sm, paddingVertical: 12, paddingHorizontal: 24 },
  buttonText: { color: "#fff", fontWeight: "700" },
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
  },
  frame: {
    width: 260,
    height: 160,
    borderWidth: 3,
    borderColor: "#fff",
    borderRadius: radii.md,
    backgroundColor: "transparent",
  },
  hint: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowRadius: 4,
  },
  cancelButton: { paddingVertical: 12, paddingHorizontal: 24 },
  cancelButtonOverlay: {
    position: "absolute",
    bottom: 48,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: radii.sm,
  },
  cancelText: { color: "#fff", fontWeight: "700" },
});
