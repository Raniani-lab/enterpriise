# -*- coding: utf-8 -*-

{
    'name': 'Social Tests (Full)',
    'version': '1.0',
    'category': 'Hidden',
    'sequence': 9878,
    'summary': 'Social Tests: tests specific to social with all sub-modules',
    'description': """This module contains tests related to various social features
and social-related sub modules. It will test interactions between all those modules.""",
    'depends': [
        'social_facebook',
        'social_twitter',
        'social_linkedin',
        'social_push_notifications',
        'social_youtube',
    ],
    'installable': True,
    'application': False,
}
