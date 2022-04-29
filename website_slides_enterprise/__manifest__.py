{
    'name': 'eLearning enterprise',
    'version': '1.0',
    'category': 'Website/eLearning',
    'description': """
    Contains advanced features for eLeaning such as new views
    """,
    'depends': ['website_slides', 'web_dashboard'],
    'installable': True,
    'auto_install': ['website_slides'],
    'data': [
        'views/slide_channel_views.xml'
    ],
    'license': 'OEEL-1',
}
