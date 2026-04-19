from rest_framework import serializers


class TenantSerializer(serializers.ModelSerializer):
    """Base serializer that auto-injects tenant on create."""

    class Meta:
        read_only_fields = ['tenant', 'id', 'created_at', 'updated_at']

    def create(self, validated_data):
        validated_data['tenant'] = self.context['request'].tenant
        return super().create(validated_data)
