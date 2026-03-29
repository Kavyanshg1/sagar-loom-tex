# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['desktop_launcher.py'],
    pathex=[],
    binaries=[],
    datas=[('../frontend/dist', 'frontend/dist'), ('schema.sql', '.'), ('textile_flow.db', '.'), ('uploads', 'uploads')],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='Sagar Loom Tex',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=['sagarloomtex.icns'],
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='Sagar Loom Tex',
)
app = BUNDLE(
    coll,
    name='Sagar Loom Tex.app',
    icon='sagarloomtex.icns',
    bundle_identifier=None,
)
