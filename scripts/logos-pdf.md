# Logos embebidos del PDF de curvas IDF

`src/worker/logosPdf.js` guarda los logos de la CUC y del IDEAM en base64. Van
embebidos porque el PDF del correo lo genera el Worker con `pdf-lib`, que recibe
bytes: no puede leer archivos ni pedirlos por red.

Los originales están en `src/imports/`:

- `Logo_CUC_PNG_letra_blanca_barra_roja_vtcal.png`
- `Ideam_(Colombia)_logo.png`

## Cómo regenerarlos

Solo hace falta si cambian los originales. Con Pillow instalado:

```python
import base64, io
from PIL import Image

for nombre, archivo in (("CUC", "Logo_CUC_PNG_letra_blanca_barra_roja_vtcal.png"),
                        ("IDEAM", "Ideam_(Colombia)_logo.png")):
    img = Image.open(f"src/imports/{archivo}").convert("RGBA")
    img = img.resize((160, round(160 * img.height / img.width)), Image.LANCZOS)
    fondo = Image.new("RGBA", img.size, (255, 255, 255, 255))
    fondo.alpha_composite(img)                       # van sobre tarjeta blanca
    img = fondo.convert("RGB").quantize(colors=64).convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    print(f'export const LOGO_{nombre}_B64 =\n  "{base64.b64encode(buf.getvalue()).decode()}";')
```

Dos decisiones a conservar:

- **160 px de ancho y 64 colores.** En el PDF van a unos 30 pt de alto, así que
  sobra para impresión, y el base64 viaja dentro del bundle del Worker: hoy son
  unos 30 KB entre los dos.
- **Aplanados sobre blanco.** En el encabezado vinotinto los logos se dibujan
  sobre una tarjeta blanca; con transparencia y tinta oscura quedaban sucios.

Los logos que usa el **cuerpo del correo** son otros: `public/email/logo-cuc.png`
y `public/email/logo-ideam.png`, servidos por URL absoluta porque los clientes de
correo no admiten imágenes embebidas de forma fiable.
