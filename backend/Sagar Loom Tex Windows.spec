# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['desktop_launcher.py'],
    pathex=['.'],
    binaries=[],
    datas=[
        ('../frontend/dist', 'frontend/dist'),
        ('schema.sql', '.'),
        ('textile_flow.db', '.'),
        ('uploads', 'uploads'),
    ],
    hiddenimports=['cv2', 'numpy'],
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
    a.binaries,
    a.datas,
    [],
    name='Sagar Loom Tex',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    icon=['sagarloomtex.ico'],
)
