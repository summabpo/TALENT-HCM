import uuid
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from .managers import UserManager


def tenant_logo_upload_to(instance, filename):
    safe = filename.replace('..', '').split('/')[-1]
    return f'tenants/{instance.pk}/logo/{safe}'


def tenant_signature_upload_to(instance, filename):
    safe = filename.replace('..', '').split('/')[-1]
    return f'tenants/{instance.pk}/signature/{safe}'


class Tenant(models.Model):
    class Language(models.TextChoices):
        ES = 'es', _('Español')
        EN = 'en', _('English')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(_('name'), max_length=255)
    slug = models.SlugField(unique=True)
    is_active = models.BooleanField(_('active'), default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    document_type = models.CharField(
        _('company document type'), max_length=50, blank=True, default='',
        help_text=_('e.g. N.I.T'),
    )
    document_number = models.CharField(
        _('verification digit'), max_length=50, blank=True, default='',
    )
    legal_representative = models.CharField(_('legal representative'), max_length=255, blank=True, default='')
    phone = models.CharField(_('phone'), max_length=20, blank=True, default='')
    arl = models.ForeignKey(
        'catalogs.SocialSecurityEntity',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='tenants_as_arl',
        limit_choices_to={'entity_type': 'ARL'},
    )
    country = models.ForeignKey(
        'catalogs.Country',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='tenants',
    )
    address = models.CharField(_('address'), max_length=255, blank=True, default='')
    city = models.ForeignKey(
        'catalogs.City',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='tenants',
    )
    email = models.EmailField(_('company email'), blank=True, default='')
    nit = models.CharField('NIT', max_length=20, blank=True, default='')
    logo = models.FileField(_('logo'), upload_to=tenant_logo_upload_to, blank=True, null=True, max_length=500)
    signature = models.FileField(
        _('certification signature'), upload_to=tenant_signature_upload_to, blank=True, null=True, max_length=500,
    )
    certification_title = models.CharField(_('certification title'), max_length=100, blank=True, default='')
    website = models.URLField(_('website'), blank=True, max_length=500)
    language = models.CharField(_('language'), max_length=2, choices=Language.choices, default=Language.ES)

    class Meta:
        db_table = 'core_tenant'
        verbose_name = _('tenant')
        verbose_name_plural = _('tenants')

    def __str__(self):
        return self.name


class TenantModules(models.Model):
    """Which modules are enabled for this tenant."""
    tenant = models.OneToOneField(Tenant, on_delete=models.CASCADE, related_name='modules')
    hiring = models.BooleanField(_('hiring'), default=True)
    personnel = models.BooleanField(_('personnel'), default=True)
    quality = models.BooleanField(_('quality'), default=True)
    performance = models.BooleanField(_('performance'), default=True)
    evaluations = models.BooleanField(_('evaluations'), default=False)
    portal = models.BooleanField(_('portal'), default=False)
    surveys = models.BooleanField(_('surveys'), default=False)
    orgchart = models.BooleanField(_('orgchart'), default=False)

    class Meta:
        db_table = 'core_tenant_modules'
        verbose_name = _('tenant modules')
        verbose_name_plural = _('tenant modules')

    def __str__(self):
        return f'{self.tenant.name} modules'

    def is_enabled(self, module: str) -> bool:
        return bool(getattr(self, module, False))


class User(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(_('email address'), unique=True)
    first_name = models.CharField(_('first name'), max_length=150, blank=True)
    last_name = models.CharField(_('last name'), max_length=150, blank=True)
    is_active = models.BooleanField(_('active'), default=True)
    is_staff = models.BooleanField(_('staff status'), default=False)
    date_joined = models.DateTimeField(_('date joined'), default=timezone.now)
    nomiweb_id = models.CharField(
        _('Nomiweb ID'), max_length=100, blank=True, db_index=True,
        help_text=_('ID in Nomiweb system for optional sync'),
    )

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['first_name', 'last_name']

    objects = UserManager()

    class Meta:
        db_table = 'core_user'
        verbose_name = _('user')
        verbose_name_plural = _('users')

    def __str__(self):
        return self.email

    @property
    def full_name(self):
        return f'{self.first_name} {self.last_name}'.strip() or self.email

    def has_role(self, role: str) -> bool:
        """Check role against JWT-injected roles for current request."""
        return role in getattr(self, '_jwt_roles', [])


class Role(models.Model):
    class Name(models.TextChoices):
        ADMIN = 'admin', _('Administrator')
        MANAGER = 'manager', _('Manager')
        EMPLOYEE = 'employee', _('Employee')
        RECRUITER = 'recruiter', _('Recruiter')
        QUALITY_AUDITOR = 'quality_auditor', _('Quality Auditor')

    name = models.CharField(
        _('name'), max_length=50, choices=Name.choices, unique=True,
    )

    class Meta:
        db_table = 'core_role'
        verbose_name = _('role')
        verbose_name_plural = _('roles')

    def __str__(self):
        return self.get_name_display()


class UserTenant(models.Model):
    """Associates a user with a tenant and their roles within that tenant."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='tenant_memberships')
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='user_memberships')
    roles = models.ManyToManyField(Role, blank=True, related_name='user_tenants')
    is_active = models.BooleanField(_('active'), default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'core_user_tenant'
        unique_together = [('user', 'tenant')]
        verbose_name = _('user tenant')
        verbose_name_plural = _('user tenants')

    def __str__(self):
        return f'{self.user.email} @ {self.tenant.name}'

    def get_role_names(self) -> list[str]:
        return list(self.roles.values_list('name', flat=True))


class TenantModel(models.Model):
    """Abstract base for all tenant-scoped models."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, db_index=True)

    class Meta:
        abstract = True


class TimestampedTenantModel(TenantModel):
    """Adds created_at and updated_at to TenantModel."""
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
