from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _


ALLOWED_IMAGE_FORMATS = {'JPEG', 'PNG', 'WEBP', 'GIF'}
MAX_IMAGE_SIZE = 2 * 1024 * 1024  # 2 MB
MAX_DOCUMENT_SIZE = 10 * 1024 * 1024  # 10 MB

DANGEROUS_EXTENSIONS = {
    '.exe', '.sh', '.bat', '.cmd', '.php',
    '.js', '.py', '.rb', '.pl', '.ps1', '.msi',
}


def validate_image_file(file):
    if file.size > MAX_IMAGE_SIZE:
        raise ValidationError(_('El archivo no puede superar 2 MB.'))

    # Verify via Pillow (magic bytes, not extension)
    from PIL import Image
    try:
        file.seek(0)
        img = Image.open(file)
        img_format = img.format
        img.verify()
        file.seek(0)
    except Exception:
        raise ValidationError(_('El archivo no es una imagen válida.'))

    if img_format not in ALLOWED_IMAGE_FORMATS:
        raise ValidationError(
            _('Formato no permitido. Use: JPEG, PNG, WEBP o GIF.')
        )


def validate_document_file(file):
    if file.size > MAX_DOCUMENT_SIZE:
        raise ValidationError(_('El archivo no puede superar 10 MB.'))

    name = file.name.lower()
    if any(name.endswith(ext) for ext in DANGEROUS_EXTENSIONS):
        raise ValidationError(_('Tipo de archivo no permitido.'))
