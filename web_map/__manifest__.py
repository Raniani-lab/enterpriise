# -*- coding: utf-8 -*-
{
    'name':"Map View",
    'summary':"Defines the map view for odoo enterprise",
    'description':"Allows the viewing of records on a map",
    'version':'1.0',
    'depends':['web'],
    'data':[
        "views/assets.xml",
        "views/res_config_settings.xml",
    ],
    'qweb':[
        "static/xml/templates.xml"
    ],
    'auto_install': True,
    'license': 'OEEL-1',
}
