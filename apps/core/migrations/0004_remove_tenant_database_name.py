from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0003_tenant_company_fields'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='tenant',
            name='database_name',
        ),
    ]
