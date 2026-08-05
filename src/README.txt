TAURI BUILD FIX V1

Verwijder oude bestanden als ze nog bestaan:
- src/BusNode.tsx
- src/URouteNode.tsx

Vervang:
- App.tsx
- CableNumberEditor.tsx
- DeviceInstanceEditor.tsx
- PdfExportDialog.tsx

Test:
npm run build

Daarna:
npm run tauri build
