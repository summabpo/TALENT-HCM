from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('personnel', '0003_add_remaining_nomiweb_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='employee',
            name='resume_file',
            field=models.FileField(
                blank=True,
                null=True,
                upload_to='employees/resumes/',
                verbose_name='resume file (PDF)',
            ),
        ),
    ]
