from rest_framework.pagination import PageNumberPagination


class TalentPageNumberPagination(PageNumberPagination):
    """
    Permite al cliente ajustar el tamaño de página (p. ej. selectores que
    listan cientos de países o ciudades). Sin esto, DRF fija 50 e ignora ?page_size=.
    """
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 5000
