import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Role',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(
                    choices=[
                        ('admin', 'Administrator'),
                        ('manager', 'Manager'),
                        ('employee', 'Employee'),
                        ('recruiter', 'Recruiter'),
                        ('quality_auditor', 'Quality Auditor'),
                    ],
                    max_length=50,
                    unique=True,
                    verbose_name='name',
                )),
            ],
            options={
                'verbose_name': 'role',
                'verbose_name_plural': 'roles',
                'db_table': 'core_role',
            },
        ),
        migrations.CreateModel(
            name='TenantModules',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('hiring', models.BooleanField(default=True, verbose_name='hiring')),
                ('personnel', models.BooleanField(default=True, verbose_name='personnel')),
                ('quality', models.BooleanField(default=True, verbose_name='quality')),
                ('performance', models.BooleanField(default=True, verbose_name='performance')),
                ('portal', models.BooleanField(default=False, verbose_name='portal')),
                ('surveys', models.BooleanField(default=False, verbose_name='surveys')),
                ('orgchart', models.BooleanField(default=False, verbose_name='orgchart')),
                ('tenant', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='modules',
                    to='core.tenant',
                )),
            ],
            options={
                'verbose_name': 'tenant modules',
                'verbose_name_plural': 'tenant modules',
                'db_table': 'core_tenant_modules',
            },
        ),
        migrations.CreateModel(
            name='UserTenant',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('is_active', models.BooleanField(default=True, verbose_name='active')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='tenant_memberships',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('tenant', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='user_memberships',
                    to='core.tenant',
                )),
                ('roles', models.ManyToManyField(
                    blank=True,
                    related_name='user_tenants',
                    to='core.role',
                )),
            ],
            options={
                'verbose_name': 'user tenant',
                'verbose_name_plural': 'user tenants',
                'db_table': 'core_user_tenant',
                'unique_together': {('user', 'tenant')},
            },
        ),
    ]
