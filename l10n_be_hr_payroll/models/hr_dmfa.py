# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import base64
import re

from collections import defaultdict
from datetime import date
from lxml import etree

from odoo import api, fields, models, _
from odoo.tools import date_utils
from odoo.exceptions import ValidationError, UserError
from odoo.modules.module import get_resource_path


def format_amount(amount, width=11, hundredth=True):
    """
    Fill a constant 11 characters string with 0
    """
    if hundredth:
        amount *= 100
    return str(int(amount)).zfill(width)

# TODO:
# - Anticipated Double Holiday Pay
# - Termination Fees (year >= 2014)

# Intellectuels ordinaire (Voir ANNEXE 2)
# Employés et apprentis de cette catégorie à partir de l'année où ils
# atteignent 19 ans: a) Employés de catégorie ordinaire. b) Sportifs
# rémunérés, limités à partir du 1er trimestre 2008 aux entraîneurs
# et arbitres de football, déclarés par des employeurs immatriculés
# sous les catégories 070 ou 076 c) Employés occasionnels déclarés
# sur base des rémunérations réelles par des employeurs
# immatriculés sous les catégories 116 et 117; d) officiers déclarés
# par des employeurs immatriculés sous les catégories 105, 205,
# 305 et 405.
# Présence autorisée pour le code travailleur (zone 00037) et le code
# travailleur cotisation (zone 00082)
WORKER_CODE = 495

# ANNEXE 4: DEDUCTIONS (Only current ones)
# Current data of interest: Employment bonus (code 0001)
# +-----------+------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+------------------------------+---------------------------+-------------------------------+---------------------------------------+-------------------------------------------------+---------------------------------------------------------------------+-------------------------------------------------------------------------+----------------+-------------+--------------------+------------------------------------+------------------------------------------------+
# | Code DMFA |                                                                                                                                                                       Libellé                                                                                                                                                                        | Réduction valide à partir du | Réduction valide jusqu'au | Réduction fédérale/ régionale | Réduction régionale - Région flamande | Réduction régionale - Région Bruxelles-Capitale | Réduction régionale - Région wallonne sans communes germano- phones | Réduction régionale - Région wallonne pour les communes germano- phones | Base de calcul |   Montant   | Date début droit à |               Niveau               | "Présence bloc ""Détail données déduc- tion""" |
# +-----------+------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+------------------------------+---------------------------+-------------------------------+---------------------------------------+-------------------------------------------------+---------------------------------------------------------------------+-------------------------------------------------------------------------+----------------+-------------+--------------------+------------------------------------+------------------------------------------------+
# |      0001 | Réduction des cotisations personnelles pour les travailleurs ayant un bonus à l'emploi                                                                                                                                                                                                                                                               | 2000/1                       | 9999/4                    | Fédérale                      | -                                     | -                                               | -                                                                   | -                                                                       | Interdit       | Obligatoire | Interdit           | Ligne travailleur                  | Non                                            |
# |      0601 | Réduction des cotisations personnelles pour les travailleurs licenciés dans le cadre d'une restructuration                                                                                                                                                                                                                                           | 2007/1                       | 9999/4                    | Fédérale                      | -                                     | -                                               | -                                                                   | -                                                                       | Interdit       | Obligatoire | Obligatoire        | Ligne travailleur                  | Non                                            |
# |      1142 | Période transitoire : économie de réinsertion sociale conclue avant le 1.1.2004                                                                                                                                                                                                                                                                      | 2021/1                       | 9999/4                    | Régionale                     | Oui                                   | Non                                             | Oui                                                                 | Oui                                                                     | Interdit       | Obligatoire | Interdit           | Occupation de la ligne travailleur | Non                                            |
# |      1511 | Recherche scientifique                                                                                                                                                                                                                                                                                                                               | 1996/4                       | 9999/4                    | Fédérale                      | -                                     | -                                               | -                                                                   | -                                                                       | Obligatoire    | Obligatoire | Interdit           | Occupation de la ligne travailleur | Non                                            |
# |      2001 | Remboursement des frais de gestion S.S.A. - premier travailleur                                                                                                                                                                                                                                                                                      | 2004/1                       | 9999/4                    | Fédérale                      | -                                     | -                                               | -                                                                   | -                                                                       | Interdit       | Interdit    | Interdit           | Ligne travailleur                  | Non                                            |
# |      3000 | Réduction structurelle                                                                                                                                                                                                                                                                                                                               | 2004/1                       | 9999/4                    | Fédérale                      | -                                     | -                                               | -                                                                   | -                                                                       | Interdit       | Obligatoire | Interdit           | Occupation de la ligne travailleur | Non                                            |
# |      3240 | Economie d'insertion sociale  moins de 45 ans 312j/18m ou 156j/9m                                                                                                                                                                                                                                                                                    | 2021/1                       | 9999/4                    | Régionale                     | Oui                                   | Non                                             | Oui                                                                 | Non                                                                     | Interdit       | Obligatoire | Interdit           | Occupation de la ligne travailleur | Non                                            |
# |      3241 | Economie d'insertion sociale  moins de 45 ans  624j/36m ou 312j/18m                                                                                                                                                                                                                                                                                  | 2021/1                       | 9999/4                    | Régionale                     | Oui                                   | Non                                             | Oui                                                                 | Non                                                                     | Interdit       | Obligatoire | Interdit           | Occupation de la ligne travailleur | Non                                            |
# |      3250 | Economie d'insertion sociale  au moins 45 ans  156j/9m                                                                                                                                                                                                                                                                                               | 2021/1                       | 9999/4                    | Régionale                     | Oui                                   | Non                                             | Oui                                                                 | Non                                                                     | Interdit       | Obligatoire | Interdit           | Occupation de la ligne travailleur | Non                                            |
# |      3315 | Premiers engagements - premier travailleur - taxshift                                                                                                                                                                                                                                                                                                | 2016/1                       | 9999/4                    | Fédérale                      | -                                     | -                                               | -                                                                   | -                                                                       | Interdit       | Obligatoire | Obligatoire        | Occupation de la ligne travailleur | Non                                            |
# |      3324 | Premiers engagements - deuxième travailleur - taxshift - première période                                                                                                                                                                                                                                                                            | 2016/1                       | 9999/4                    | Fédérale                      | -                                     | -                                               | -                                                                   | -                                                                       | Interdit       | Obligatoire | Obligatoire        | Occupation de la ligne travailleur | Non                                            |
# |      3325 | Premiers engagements - deuxième travailleur - taxshift - deuxième période                                                                                                                                                                                                                                                                            | 2017/2                       | 9999/4                    | Fédérale                      | -                                     | -                                               | -                                                                   | -                                                                       | Interdit       | Obligatoire | Obligatoire        | Occupation de la ligne travailleur | Non                                            |
# |      3326 | Premiers engagements - deuxième travailleur - taxshift - troisième période                                                                                                                                                                                                                                                                           | 2018/2                       | 9999/4                    | Fédérale                      | -                                     | -                                               | -                                                                   | -                                                                       | Interdit       | Obligatoire | Obligatoire        | Occupation de la ligne travailleur | Non                                            |
# |      3333 | Premiers engagements - troisième travailleur - taxshift - première période                                                                                                                                                                                                                                                                           | 2016/1                       | 9999/4                    | Fédérale                      | -                                     | -                                               | -                                                                   | -                                                                       | Interdit       | Obligatoire | Obligatoire        | Occupation de la ligne travailleur | Non                                            |
# |      3334 | Premiers engagements - troisième travailleur - taxshift - deuxième période                                                                                                                                                                                                                                                                           | 2017/2                       | 9999/4                    | Fédérale                      | -                                     | -                                               | -                                                                   | -                                                                       | Interdit       | Obligatoire | Obligatoire        | Occupation de la ligne travailleur | Non                                            |
# |      3342 | Premiers engagements - quatrième travailleur - taxshift - première période                                                                                                                                                                                                                                                                           | 2016/1                       | 9999/4                    | Fédérale                      | -                                     | -                                               | -                                                                   | -                                                                       | Interdit       | Obligatoire | Obligatoire        | Occupation de la ligne travailleur | Non                                            |
# |      3343 | Premiers engagements - quatrième travailleur - taxshift - deuxième période                                                                                                                                                                                                                                                                           | 2017/2                       | 9999/4                    | Fédérale                      | -                                     | -                                               | -                                                                   | -                                                                       | Interdit       | Obligatoire | Obligatoire        | Occupation de la ligne travailleur | Non                                            |
# |      3352 | Premiers engagements - cinquième travailleur - taxshift - première période                                                                                                                                                                                                                                                                           | 2016/1                       | 9999/4                    | Fédérale                      | -                                     | -                                               | -                                                                   | -                                                                       | Interdit       | Obligatoire | Obligatoire        | Occupation de la ligne travailleur | Non                                            |
# |      3353 | Premiers engagements - cinquième travailleur - taxshift - deuxième période                                                                                                                                                                                                                                                                           | 2017/2                       | 9999/4                    | Fédérale                      | -                                     | -                                               | -                                                                   | -                                                                       | Interdit       | Obligatoire | Obligatoire        | Occupation de la ligne travailleur | Non                                            |
# |      3360 | Premiers engagements - sixième travailleur - taxshift - première période                                                                                                                                                                                                                                                                             | 2016/1                       | 9999/4                    | Fédérale                      | -                                     | -                                               | -                                                                   | -                                                                       | Interdit       | Obligatoire | Obligatoire        | Occupation de la ligne travailleur | Non                                            |
# |      3361 | Premiers engagements - sixième travailleur - taxshift - deuxième période                                                                                                                                                                                                                                                                             | 2017/2                       | 9999/4                    | Fédérale                      | -                                     | -                                               | -                                                                   | -                                                                       | Interdit       | Obligatoire | Obligatoire        | Occupation de la ligne travailleur | Non                                            |
# |      3500 | Réduction du temps de travail                                                                                                                                                                                                                                                                                                                        | 2004/1                       | 9999/4                    | Fédérale                      | -                                     | -                                               | -                                                                   | -                                                                       | Interdit       | Obligatoire | Interdit           | Occupation de la ligne travailleur | Oui                                            |
# |      3510 | Semaine de quatre jours                                                                                                                                                                                                                                                                                                                              | 2004/1                       | 9999/4                    | Fédérale                      | -                                     | -                                               | -                                                                   | -                                                                       | Interdit       | Obligatoire | Obligatoire        | Occupation de la ligne travailleur | Non                                            |
# |      3520 | Réduction du temps de travail et semaine de quatre jours                                                                                                                                                                                                                                                                                             | 2004/1                       | 9999/4                    | Fédérale                      | -                                     | -                                               | -                                                                   | -                                                                       | Interdit       | Obligatoire | Obligatoire        | Occupation de la ligne travailleur | Oui                                            |
# |      3700 | Réduction temporaire du temps de travail suite à la crise                                                                                                                                                                                                                                                                                            | 2020/3                       | 9999/4                    | Fédérale                      | -                                     | -                                               | -                                                                   | -                                                                       | Interdit       | Obligatoire | Interdit           | Occupation de la ligne travailleur | Oui                                            |
# |      3701 | Réduction temporaire du temps de travail suite au Brexit                                                                                                                                                                                                                                                                                             | 2021/1                       | 9999/4                    | Fédérale                      | -                                     | -                                               | -                                                                   | -                                                                       | Interdit       | Obligatoire | Interdit           | Occupation de la ligne travailleur | Oui                                            |
# |      3720 | Réduction temporaire du temps de travail combinée avec la semaine de quatre jours suite à la crise                                                                                                                                                                                                                                                   | 2020/3                       | 9999/4                    | Fédérale                      | -                                     | -                                               | -                                                                   | -                                                                       | Interdit       | Obligatoire | Interdit           | Occupation de la ligne travailleur | Oui                                            |
# |      3721 | Réduction temporaire du temps de travail combinée avec la semaine de quatre jours suite au Brexit                                                                                                                                                                                                                                                    | 2021/1                       | 9999/4                    | Fédérale                      | -                                     | -                                               | -                                                                   | -                                                                       | Interdit       | Obligatoire | Interdit           | Occupation de la ligne travailleur | Oui                                            |
# |      3800 | Tuteurs                                                                                                                                                                                                                                                                                                                                              | 2018/3                       | 9999/4                    | Régionale                     | Oui                                   | Non                                             | Non                                                                 | Oui                                                                     | Interdit       | Obligatoire | Interdit           | Occupation de la ligne travailleur | Non                                            |
# |      3900 | Travailleurs permanents dans l'horeca                                                                                                                                                                                                                                                                                                                | 2014/1                       | 9999/4                    | Fédérale                      | -                                     | -                                               | -                                                                   | -                                                                       | Interdit       | Obligatoire | Interdit           | Occupation de la ligne travailleur | Non                                            |
# |      4000 | Contractuels subventionnés                                                                                                                                                                                                                                                                                                                           | 2018/1                       | 9999/4                    | Régionale                     | Oui                                   | Oui                                             | Oui                                                                 | Non                                                                     | Interdit       | Obligatoire | Interdit           | Occupation de la ligne travailleur | Non                                            |
# |      4001 | Contractuels subventionnés des administrations provinciales et locales                                                                                                                                                                                                                                                                               | 2022/1                       | 9999/4                    | Régionale                     | Non                                   | Oui                                             | Oui                                                                 | Non                                                                     | Interdit       | Obligatoire | Interdit           | Occupation de la ligne travailleur | Non                                            |
# |      4100 | Remplaçants de contractuels et de statutaires dans le secteur public                                                                                                                                                                                                                                                                                 | 2014/1                       | 9999/4                    | Fédérale                      | -                                     | -                                               | -                                                                   | -                                                                       | Interdit       | Obligatoire | Interdit           | Occupation de la ligne travailleur | Non                                            |
# |      4200 | Personnel de maison                                                                                                                                                                                                                                                                                                                                  | 2017/3                       | 9999/4                    | Régionale                     | Oui                                   | Oui                                             | Non                                                                 | Oui                                                                     | Interdit       | Obligatoire | Interdit           | Occupation de la ligne travailleur | Non                                            |
# |      4300 | Artistes                                                                                                                                                                                                                                                                                                                                             | 2014/1                       | 9999/4                    | Régionale                     | Oui                                   | Oui                                             | Oui                                                                 | Oui                                                                     | Interdit       | Obligatoire | Interdit           | Occupation de la ligne travailleur | Non                                            |
# |      4400 | Gardiens et gardiennes d'enfants reconnus                                                                                                                                                                                                                                                                                                            | 2014/1                       | 9999/4                    | Régionale                     | Oui                                   | Oui                                             | Oui                                                                 | Oui                                                                     | Interdit       | Obligatoire | Interdit           | Occupation de la ligne travailleur | Non                                            |
# |      4500 | Travailleurs engagés dans le cadre de l'article 60 § 7 de la loi organique des CPAS du 08.07.1976                                                                                                                                                                                                                                                    | 2022/1                       | 9999/4                    | Régionale                     | Non                                   | Oui                                             | Oui                                                                 | Oui                                                                     | Interdit       | Obligatoire | Interdit           | Occupation de la ligne travailleur | Non                                            |
# |      6300 | Jeunes travailleurs peu qualifiés                                                                                                                                                                                                                                                                                                                    | 2016/3                       | 9999/4                    | Régionale                     | Oui                                   | Non                                             | Non                                                                 | Non                                                                     | Interdit       | Obligatoire | Obligatoire        | Occupation de la ligne travailleur | Non                                            |
# |      6310 | Jeunes travailleurs apprentis                                                                                                                                                                                                                                                                                                                        | 2016/3                       | 9999/4                    | Régionale                     | Oui                                   | Non                                             | Non                                                                 | Non                                                                     | Interdit       | Obligatoire | Interdit           | Occupation de la ligne travailleur | Non                                            |
# |      6311 | Jeunes travailleurs  - en formation en alternance                                                                                                                                                                                                                                                                                                    | 2017/1                       | 9999/4                    | Régionale                     | Oui                                   | Non                                             | Non                                                                 | Non                                                                     | Interdit       | Obligatoire | Interdit           | Occupation de la ligne travailleur | Non                                            |
# |      6320 | Travailleurs âgés - en activité                                                                                                                                                                                                                                                                                                                      | 2016/3                       | 9999/4                    | Régionale                     | Oui                                   | Non                                             | Non                                                                 | Non                                                                     | Interdit       | Obligatoire | Interdit           | Occupation de la ligne travailleur | Non                                            |
# |      6321 | Travailleurs âgés - nouvel engagé                                                                                                                                                                                                                                                                                                                    | 2016/3                       | 9999/4                    | Régionale                     | Oui                                   | Non                                             | Non                                                                 | Non                                                                     | Interdit       | Obligatoire | Obligatoire        | Occupation de la ligne travailleur | Non                                            |
# |      6330 | Réduction des cotisations patronales pour la marine marchande  le secteur du dragage et du remorquage                                                                                                                                                                                                                                                | 2018/1                       | 9999/4                    | Régionale                     | Oui                                   | Non                                             | Non                                                                 | Non                                                                     | Obligatoire    | Obligatoire | Interdit           | Occupation de la ligne travailleur | Non                                            |
# |      7320 | Travailleurs âgés                                                                                                                                                                                                                                                                                                                                    | 2016/4                       | 9999/4                    | Régionale                     | Non                                   | Oui                                             | Non                                                                 | Non                                                                     | Interdit       | Obligatoire | Interdit           | Occupation de la ligne travailleur | Non                                            |
# |      8009 | Mesure transitoire - Programme de transition professionnelle moins de 25 ans moins qualifiés au moins 9 mois d'allocations ou moins de 45 ans au moins 12 mois d'allocation                                                                                                                                                                          | 2017/3                       | 9999/4                    | Régionale                     | Non                                   | Non                                             | Oui                                                                 | Non                                                                     | Interdit       | Obligatoire | Interdit           | Occupation de la ligne travailleur | Non                                            |
# |      8010 | Mesure transitoire - Programme de transition professionnelle moins de 45 ans  au moins 24 mois d'allocations                                                                                                                                                                                                                                         | 2017/3                       | 9999/4                    | Régionale                     | Non                                   | Non                                             | Oui                                                                 | Non                                                                     | Interdit       | Obligatoire | Interdit           | Occupation de la ligne travailleur | Non                                            |
# |      8011 | Mesure transitoire - Programme de transition professionnelle au moins 45 ans  au moins 12 mois d'allocations                                                                                                                                                                                                                                         | 2017/3                       | 9999/4                    | Régionale                     | Non                                   | Non                                             | Oui                                                                 | Non                                                                     | Interdit       | Obligatoire | Interdit           | Occupation de la ligne travailleur | Non                                            |
# |      8012 | Mesure transitoire - Programme de transition professionnelle au moins 45 ans  au moins 24 mois d'allocations                                                                                                                                                                                                                                         | 2017/3                       | 9999/4                    | Régionale                     | Non                                   | Non                                             | Oui                                                                 | Non                                                                     | Interdit       | Obligatoire | Interdit           | Occupation de la ligne travailleur | Non                                            |
# |      8320 | Travailleurs âgés                                                                                                                                                                                                                                                                                                                                    | 2017/3                       | 9999/4                    | Régionale                     | Non                                   | Non                                             | Oui                                                                 | Non                                                                     | Interdit       | Obligatoire | Interdit           | Occupation de la ligne travailleur | Non                                            |
# |      9002 | Mesure transitoire - Economie d'insertion sociale  au moins 45 ans  156j/9m                                                                                                                                                                                                                                                                          | 2019/1                       | 9999/4                    | Régionale                     | Non                                   | Non                                             | Non                                                                 | Oui                                                                     | Interdit       | Obligatoire | Interdit           | Occupation de la ligne travailleur | Non                                            |
# |      9300 | Travailleurs âgés                                                                                                                                                                                                                                                                                                                                    | 2019/1                       | 9999/4                    | Régionale                     | Non                                   | Non                                             | Non                                                                 | Oui                                                                     | Interdit       | Obligatoire | Interdit           | Occupation de la ligne travailleur | Non                                            |
# |      3203 | Mesure transitoire - Plan Activa - Demandeurs d'emploi de longue durée  moins de 45 ans  pendant 1560 jours dans une période de 90 mois  Codes ONEM : C7  C8  C28  C33 ou C39                                                                                                                                                                        | 2019/1                       | 2023/4                    | Régionale                     | Non                                   | Non                                             | Non                                                                 | Oui                                                                     | Interdit       | Obligatoire | Obligatoire        | Occupation de la ligne travailleur | Non                                            |
# |      3210 | Mesure transitoire - Plan Activa - Demandeurs d'emploi de longue durée  au moins de 45 ans  pendant 156 jours dans une période de 9 mois  Codes ONEM : D1  D13 ou D19                                                                                                                                                                                | 2019/1                       | 2023/4                    | Régionale                     | Non                                   | Non                                             | Non                                                                 | Oui                                                                     | Interdit       | Obligatoire | Obligatoire        | Occupation de la ligne travailleur | Non                                            |
# |      3211 | Mesure transitoire - Plan Activa - Demandeurs d'emploi de longue durée  au moins de 45 ans  pendant 312 jours dans une période de 18 mois  ou pendant 468 jours dans une période de 27 mois  Codes ONEM : D3  D4  D5  D6  D14  D15  D16  D17  D20 ou D21                                                                                             | 2019/1                       | 2023/4                    | Régionale                     | Non                                   | Non                                             | Non                                                                 | Oui                                                                     | Interdit       | Obligatoire | Obligatoire        | Occupation de la ligne travailleur | Non                                            |
# |      3611 | Mesure transitoire - Travailleurs licenciés dans le cadre d'une restructuration - réduction des cotisations patronales - au moins 45 ans                                                                                                                                                                                                             | 2019/1                       | 2023/4                    | Régionale                     | Non                                   | Non                                             | Non                                                                 | Oui                                                                     | Interdit       | Obligatoire | Obligatoire        | Occupation de la ligne travailleur | Non                                            |
# |      9001 | Mesure transitoire - Economie d'insertion sociale  moins de 45 ans  624j/36m ou 312j/18m                                                                                                                                                                                                                                                             | 2019/1                       | 2023/4                    | Régionale                     | Non                                   | Non                                             | Non                                                                 | Oui                                                                     | Interdit       | Obligatoire | Interdit           | Occupation de la ligne travailleur | Non                                            |
# |      3411 | Mesure transitoire - Jeunes travailleurs CPE et très peu qualifiés Ou CPE et moins qualifiés handicapés Ou CPE et moins qualifiés d'origine étrangère                                                                                                                                                                                                | 2019/1                       | 2022/3                    | Régionale                     | Non                                   | Non                                             | Non                                                                 | Oui                                                                     | Interdit       | Obligatoire | Obligatoire        | Occupation de la ligne travailleur | Non                                            |
# |      3202 | Mesure transitoire - Plan Activa - Demandeurs d'emploi de longue durée  moins de 45 ans  pendant 936 jours dans une période de 54 mois  Codes ONEM : C5  C6  C27  C32 ou C38                                                                                                                                                                         | 2019/1                       | 2021/4                    | Régionale                     | Non                                   | Non                                             | Non                                                                 | Oui                                                                     | Interdit       | Obligatoire | Obligatoire        | Occupation de la ligne travailleur | Non                                            |
# |      3430 | Mesure transitoire - Jeunes travailleurs : jusqu'au 31/12 de l'année dans laquelle les jeunes auront 18 ans                                                                                                                                                                                                                                          | 2019/1                       | 2021/4                    | Régionale                     | Non                                   | Non                                             | Non                                                                 | Oui                                                                     | Interdit       | Obligatoire | Obligatoire        | Occupation de la ligne travailleur | Non                                            |
# |      3205 | Mesure transitoire - Plan Activa - Demandeurs d'emploi de longue durée moins de 27 ans  pendant 312 jours dans une période de 18 mois et moins qualifiés Codes ONEM : C40 ou C41  ou à partir du 2014/1 demandeurs d'emploi de longue durée moins de 30 ans  pendant 156 jours dans une période de 9 mois et moins qualifiés Codes ONEM : C42 ou C43 | 2019/1                       | 2021/3                    | Régionale                     | Non                                   | Non                                             | Non                                                                 | Oui                                                                     | Interdit       | Obligatoire | Obligatoire        | Occupation de la ligne travailleur | Non                                            |
# |      3410 | Mesure transitoire - Jeunes travailleurs CPE et moins qualifiés                                                                                                                                                                                                                                                                                      | 2019/1                       | 2021/3                    | Régionale                     | Non                                   | Non                                             | Non                                                                 | Oui                                                                     | Interdit       | Obligatoire | Obligatoire        | Occupation de la ligne travailleur | Non                                            |
# |      3412 | Mesure transitoire - Jeunes travailleurs CPE et moyennement qualifiés                                                                                                                                                                                                                                                                                | 2019/1                       | 2021/3                    | Régionale                     | Non                                   | Non                                             | Non                                                                 | Oui                                                                     | Interdit       | Obligatoire | Obligatoire        | Occupation de la ligne travailleur | Non                                            |
# |      6301 | Jeunes travailleurs moyennement qualifiés                                                                                                                                                                                                                                                                                                            | 2016/3                       | 2021/3                    | Régionale                     | Oui                                   | Non                                             | Non                                                                 | Non                                                                     | Interdit       | Obligatoire | Obligatoire        | Occupation de la ligne travailleur | Non                                            |
# |      9000 | Mesure transitoire - Economie d'insertion sociale  moins de 45 ans  312j/18m ou 156j/9m                                                                                                                                                                                                                                                              | 2019/1                       | 2021/2                    | Régionale                     | Non                                   | Non                                             | Non                                                                 | Oui                                                                     | Interdit       | Obligatoire | Interdit           | Occupation de la ligne travailleur | Non                                            |
# +-----------+------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+------------------------------+---------------------------+-------------------------------+---------------------------------------+-------------------------------------------------+---------------------------------------------------------------------+-------------------------------------------------------------------------+----------------+-------------+--------------------+------------------------------------+------------------------------------------------+

# ANNEXE 21: Liste des valeurs autorisées pour le statut du travailleur
# Currently nothing of interest. YTI: The special status could be added on the contract form to manage this in the future.
# under the WorkerStatus tag
# +------+------+--------------------------------------------------------------------------------------------------+------------------------------+---------------------------+,
# | Code | ONSS |                                           Description                                            | Valide à partir du trimestre | Valide jusqu'au trimestre |,
# +------+------+--------------------------------------------------------------------------------------------------+------------------------------+---------------------------+,
# | A    | Yes  | Artiste                                                                                          | 1900/1                       | 2003/2                    |,
# | A1   | Yes  | Artiste avec un contrat de travail                                                               | 2014/1                       | 9999/4                    |,
# | A2   | Yes  | Artiste sans contrat de travail (article 1bis)                                                   | 2014/1                       | 9999/4                    |,
# | B    | No   | Pompiers volontaires                                                                             | 1900/1                       | 2021/4                    |,
# | B    | Yes  | Pompiers volontaires                                                                             | 2022/1                       | 9999/4                    |,
# | BA   | Yes  | Travailleur occupé en dehors du circuit normal du travail                                        | 2020/3                       | 9999/4                    |,
# | C    | No   | Concierges                                                                                       | 1900/1                       | 2021/4                    |,
# | CM   | Yes  | Candidat militaire                                                                               | 1900/1                       | 2003/4                    |,
# | D    | Yes  | Travailleur à domicile                                                                           | 1900/1                       | 9999/4                    |,
# | D1   | Yes  | Travailleur à domicile Accueillants d'enfants Communauté flamande                                | 2015/1                       | 9999/4                    |,
# | D2   | Yes  | Travailleur à domicile Accueillants d'enfants Communauté française                               | 2018/1                       | 9999/4                    |,
# | E    | Yes  | Personnel des établissements d'enseignement qui est déclaré en Dimona auprès (...)               | 2022/1                       | 9999/4                    |,
# | EC   | Yes  | Ministres des cultes et conseillers laïcs                                                        | 2022/1                       | 9999/4                    |,
# | ET   | No   | Statutaire temporaire dans l'enseignement déclaré en Dimona par (...)                            | 2017/2                       | 2021/4                    |,
# | F1   | No   | Stagiaires avec le régime d'indemnisation accident des apprentis                                 | 2020/1                       | 9999/4                    |,
# | F2   | No   | Stagiaires avec un régime d'indemnisation accident autre que celui des apprentis                 | 2020/1                       | 9999/4                    |,
# | LP   | Yes  | Travailleurs avec des prestations réduites                                                       | 2003/1                       | 9999/4                    |,
# | M    | No   | Médecins                                                                                         | 1900/1                       | 2021/4                    |,
# | MA   | Yes  | Mandataires contractuels dans un service public à qui est accordé un complément pension          | 2011/1                       | 9999/4                    |,
# | O    | No   | Personnel des établissements d'enseignement                                                      | 2007/1                       | 2021/4                    |,
# | P    | No   | Personnel de police                                                                              | 1900/1                       | 2021/4                    |,
# | PC   | No   | Personnel civil de police                                                                        | 1900/1                       | 2021/4                    |,
# | RM   | Yes  | Militaire de réserve                                                                             | 2020/1                       | 9999/4                    |,
# | S    | Yes  | Saisonnier                                                                                       | 1900/1                       | 9999/4                    |,
# | SA   | No   | Personnel technique et administratif professionnel des services d'incendie                       | 2013/1                       | 2021/4                    |,
# | SA   | Yes  | Personnel technique et administratif professionnel des services d'incendie                       | 2022/1                       | 9999/4                    |,
# | SP   | No   | Personnel opérationnel professionnel des services d'incendie                                     | 1900/1                       | 2021/4                    |,
# | SP   | Yes  | Personnel opérationnel professionnel des services d'incendie                                     | 2022/1                       | 9999/4                    |,
# | SS   | Yes  | Statutaires stagiaires non assujettis à un régime de pension du secteur public                   | 2017/2                       | 9999/4                    |,
# | T    | Yes  | Temporaire                                                                                       | 1900/1                       | 9999/4                    |,
# | TS   | Yes  | Statutaire temporaire dans l'enseignement rémunéré par (...)                                     | 2017/2                       | 9999/4                    |,
# | TW   | No   | Chercheur d'emploi expérience professionnelle temporaire dans la Région flamande                 | 2019/2                       | 2021/4                    |,
# | TW   | Yes  | Chercheur d'emploi expérience professionnelle temporaire dans la Région flamande                 | 2022/1                       | 9999/4                    |,
# | V    | No   | Personnel soignant  infirmier et paramédical qui n'appartient pas aux secteurs de santé fédéraux | 1900/1                       | 2021/4                    |,
# | V    | Yes  | Personnel soignant  infirmier et paramédical qui n'appartient pas aux secteurs de santé fédéraux | 2022/1                       | 9999/4                    |,
# | VA   | Yes  | Ambulancier volontaire ou volontaire de la Sécurité Civile                                       | 2018/1                       | 9999/4                    |,
# | VF   | No   | Personnel soignant  infirmier et paramédical qui appartient aux secteurs de santé fédéraux       | 2005/1                       | 2021/4                    |,
# | VF   | Yes  | Personnel soignant  infirmier et paramédical qui appartient aux secteurs de santé fédéraux       | 2022/1                       | 9999/4                    |,
# | WF   | Yes  | Personnel des secteurs de santé fédéraux et qui n'est pas du personnel soignant                  | 2022/1                       | 9999/4                    |,
# +------+------+--------------------------------------------------------------------------------------------------+------------------------------+---------------------------+,

class DMFANode:

    def __init__(self, env, sequence=1):
        self.env = env
        self.sequence = sequence

    @classmethod
    def init_multi(cls, args_list):
        """
        Create multiple instances, each with a consecutive sequence number
        :param args_list: list of __init__ parameters
        :return: list of instances
        """
        sequence = 1
        instances = []
        for args in args_list:
            instances.append(cls(*args, sequence=sequence))
            sequence += 1
        return instances


class DMFANaturalPerson(DMFANode):
    """
    Represents an employee or a student
    """
    def __init__(self, employee, payslips, quarter_start, quarter_end, sequence=1):
        super().__init__(employee.env, sequence=sequence)
        self.employee = employee
        self.payslips = payslips
        self.identification_id = employee.ssnid
        self.quarter_start = quarter_start
        self.quarter_end = quarter_end
        self.worker_records = DMFAWorker.init_multi([(payslips, quarter_start, quarter_end)])


class DMFAWorker(DMFANode):
    """
    Represents the employee contracts
    """
    def __init__(self, payslips, quarter_start, quarter_end, sequence=1):
        super().__init__(payslips.env, sequence=sequence)
        self.payslips = payslips
        self.quarter_start = quarter_start
        self.quarter_end = quarter_end

        self.frontier_worker = 0
        self.activity_with_risk = -1

        self.worker_code = WORKER_CODE
        self.local_unit_id = -1 # Deprecated since 2014

        self.occupations = self._prepare_occupations(self.payslips.mapped('contract_id'))
        self.deductions = self._prepare_deductions()
        self.contributions = self._prepare_contributions()

    def _prepare_contributions(self):
        lines = self.env['hr.payslip.line']
        contribution_rules = (
            self.env.ref('l10n_be_hr_payroll.cp200_employees_salary_onss_rule'),
            self.env.ref('l10n_be_hr_payroll.cp200_employees_termination_fees_onss'),
            # self.env.ref('l10n_be_hr_payroll.cp200_employees_termination_n_rules_onss_termination'),  # Pecule de vacances déjà déclaré en global
            # self.env.ref('l10n_be_hr_payroll.cp200_employees_termination_n1_rules_onss_termination'), # Pecule de vacances déjà déclaré en global
            self.env.ref('l10n_be_hr_payroll.cp200_employees_thirteen_month_onss_rule'),
        )
        for line in self.payslips.mapped('line_ids'):
            if line.salary_rule_id in contribution_rules:
                lines |= line
        return [DMFAWorkerContribution(lines)]

    def _prepare_occupations(self, contracts):
        values = []
        termination_fees = self.env.ref('l10n_be_hr_payroll.hr_payroll_structure_cp200_employee_termination_fees')
        # Group contracts with the same occupation
        # as they should be declared together
        # Put termination fees in it's own occupation
        occupation_data = contracts._get_occupation_dates()
        for data in occupation_data:
            occupation_contracts, date_from, date_to = data
            payslips = self.payslips.filtered(lambda p: p.contract_id in occupation_contracts)
            termination_payslip = payslips.filtered(lambda p: p.struct_id == termination_fees)
            if termination_payslip:
                # YTI TODO master: Store the supposed notice period even for termination fees
                termination_wizard = self.env['hr.payslip.employee.depature.notice'].new({'employee_id': 44, 'start_notice_period': date_to, 'notice_respect': 'with'})
                termination_wizard._onchange_notice_duration()
                termination_from = date_to
                termination_to = termination_wizard.end_notice_period
                values.append((contracts, termination_payslip, termination_from, termination_to))
            values.append((contracts, payslips - termination_payslip, date_from, date_to))
        return DMFAOccupation.init_multi(values)

    def _prepare_deductions(self):
        """ Only employement bonus deduction is currently supported """
        employement_bonus_rule = self.env.ref('l10n_be_hr_payroll.cp200_employees_salary_employment_bonus_employees')
        employement_deduction_lines = self.payslips.mapped('line_ids').filtered(lambda l: l.salary_rule_id == employement_bonus_rule)
        if employement_deduction_lines:
            return [DMFAWorkerDeduction(employement_deduction_lines, code='0001')]
        return []


class DMFAWorkerContribution(DMFANode):
    """
    Represents the paid amounts on the employee payslips
    """

    def __init__(self, payslip_lines, sequence=None):
        super().__init__(payslip_lines.env, sequence=sequence)
        self.worker_code = WORKER_CODE
        self.contribution_type = 2  # only code for worker 495; see annexe 3
        self.amount = format_amount(- sum(payslip_lines.mapped('total')))
        self.calculation_basis = -1
        self.first_hiring_date = -1


class DMFAOccupation(DMFANode):
    """
    Represents the contract
    """
    def __init__(self, contracts, payslips, date_from, date_to, sequence=1):
        super().__init__(contracts.env, sequence=sequence)
        # YTI Check Termination fees
        contract = contracts.sorted(key='date_start', reverse=True)[0]
        calendar = contract.resource_calendar_id
        self.contract = contract
        self.payslips = payslips

        self.date_start = date_from
        self.date_stop = date_to

        # YTI TODO: Add a time credit + a contractual part time demo to check this
        if contract.time_credit or contract.resource_calendar_id.work_time_rate < 100:
            hours_per_week = contract.resource_calendar_id.hours_per_week
            self.ref_mean_working_hours = ('%.2f' % hours_per_week).replace('.', '').zfill(4)
        else:
            self.ref_mean_working_hours = -1

        self.reorganisation_measure = -1
        self.employment_promotion = -1
        self.worker_status = -1
        self.retired = '0'
        self.apprenticeship = -1
        self.remun_method = -1
        self.position_code = -1
        self.flying_staff_class = -1
        self.TenthOrTwelfth = -1
        self.ActivityCode = -1  # Facultative
        self.days_justification = -1 # YTI: Will be useful for payroll based on attendances

        days_per_week = len(set(calendar.mapped('attendance_ids.dayofweek')))
        self.days_per_week = format_amount(days_per_week, width=3)
        self.mean_working_hours = int(days_per_week * calendar.hours_per_day)
        self.is_parttime = 1 if calendar.is_fulltime else 0
        self.commission = 200  # only CP200 currently supported
        self.services = self._prepare_services()
        self.remunerations = self._prepare_remunerations()
        self.occupation_informations = self._prepare_occupation_informations()
        work_address = contract.employee_id.address_id
        location_unit = self.env['l10n_be.dmfa.location.unit'].search([('partner_id', '=', work_address.id)])
        self.work_place = format_amount(location_unit._get_code(), width=10, hundredth=False)

    def _prepare_services(self):
        services_by_dmfa_code = defaultdict(lambda: self.env['hr.payslip.worked_days'])
        for wd in self.payslips.mapped('worked_days_line_ids'):
            # Don't declare out of contract + credit time / parental time off
            if wd.work_entry_type_id.dmfa_code != '-1' and wd.work_entry_type_id.code not in ['OUT', 'LEAVE300', 'LEAVE301']:
                services_by_dmfa_code[wd.work_entry_type_id.dmfa_code] |= wd
        return DMFAService.init_multi([(wds,) for wds in services_by_dmfa_code.values()])

    def _prepare_remunerations(self):
        # ANNEXE 7: Codification des rémunérations
        # +------+-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
        # | Code |                                                                                                                                          Libellé                                                                                                                                          |
        # +------+-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
        # |    1 | Tous les montants qui sont toujours considérés comme rémunération  à l'exception des indemnités mentionnées sous un autre code.                                                                                                                                                           |
        # |    2 | Les primes et les avantages similaires accordés indépendamment du nombre de journées de travail prestées effectivement durant le trimestre de la déclaration.                                                                                                                             |
        # |    3 | Les indemnités qui sont payées au travailleur lorsqu'il est mis fin au contrat de travail et qui sont exprimées en temps de travail.                                                                                                                                                      |
        # |    4 | Indemnités qui sont payées au travailleur lorsqu'il est mis fin au contrat de travail et qui ne sont pas exprimées en temps de travail.                                                                                                                                                   |
        # |    5 | Primes reçues par le travailleur qui limite ses prestations de travail dans le cadre des mesures de redistribution du travail.                                                                                                                                                            |
        # |    6 | Indemnités pour les heures qui ne constituent pas un temps de travail au sens de la loi du 16 mars 1971 sur le travail  accordées en vertu d'une convention collective de travail conclue au sein d'un organe paritaire avant le 1er janvier 1994 et rendue obligatoire par arrêté royal. |
        # |    7 | Pécule simple de vacances de sortie payé aux employés et soumis aux cotisations.                                                                                                                                                                                                          |
        # |    9 | Les indemnités qui sont payées au fonctionnaire statutaire lorsqu'il est mis fin à la relation de travail et qui sont exprimées en temps de travail.                                                                                                                                      |
        # |   10 | Avantage de toute nature sur l'utilisation personnelle d'un véhicule de société ou  jusqu'au 31/12/2020  sur l'allocation de mobilité contre restitution d'un véhicule de société ou sur le véhicule de société respectueux de l'environnement dans le cadre du budget de mobilité.       |
        # |   11 | Pécule simple de vacances de sortie payé aux employés et non soumis aux cotisations.                                                                                                                                                                                                      |
        # |   12 | Partie du pécule simple de vacances qui correspond au salaire normal des jours de vacances et qui a été payé anticipativement par l'employeur précédent et non soumis aux cotisations.                                                                                                    |
        # |   13 | Indemnités pour les heures supplémentaires à ne pas récupérer et non soumises aux cotisations de sécurité sociale                                                                                                                                                                         |
        # |   20 | Eléments constitutifs spécifiques de la rémunération qui sont considérés comme rémunération dans le cas des pensionnés pour l'application des règles en matière de cumul d'une pension de retraite et de survie et un revenu résultant d'une activité professionnelle.                    |
        # |   22 | Rémunération Flexi                                                                                                                                                                                                                                                                        |
        # |   23 | Primes payées à un travailleur flexijob                                                                                                                                                                                                                                                   |
        # |   24 | Avantages non soumis aux cotisations ONSS ordinaires pris en compte pour les subsides                                                                                                                                                                                                     |
        # |   25 | Intervention pour les déplacements en mission                                                                                                                                                                                                                                             |
        # |   26 | Primes et/ou subsides autres que Maribel social perçus par l'employeur                                                                                                                                                                                                                    |
        # |   27 | Indemnité pour un membre d'un parlement ou d'un gouvernement fédéral ou régional ou d'un mandataire local protégé                                                                                                                                                                         |
        # |   28 | Indemnité de sortie d'un membre d'un parlement  d'un gouvernement  d'une Députation permanente ou d'un collège provincial                                                                                                                                                                 |
        # |   29 | Solde du budget mobilité versé en espèces et qui correspond au 3ème pilier                                                                                                                                                                                                                |
        # |   41 | Indemnité pour responsabilités supplémentaires d'un membre du parlement/gouvernement fédéral ou régional                                                                                                                                                                                  |
        # |   51 | Indemnité payée à un membre du personnel nommé à titre définitif qui est totalement absent dans le cadre d'une mesure de réorganisation du temps de travail                                                                                                                               |
        # +------+-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
        # YTI TODO: Add a field dmfa_remuneration_code on hr.salary.rule
        regular_gross = self.env.ref('l10n_be_hr_payroll.cp200_employees_salary_gross_salary')
        regular_car = self.env.ref('l10n_be_hr_payroll.cp200_employees_salary_company_car')
        rule_13th_month_gross = self.env.ref('l10n_be_hr_payroll.cp200_employees_thirteen_month_gross_salary')
        termination_n = self.env.ref('l10n_be_hr_payroll.cp200_employees_termination_n_pay_simple')
        termination_n1 = self.env.ref('l10n_be_hr_payroll.cp200_employees_termination_n1_pay_simple')
        termination_fees = self.env.ref('l10n_be_hr_payroll.cp200_employees_termination_fees_basic')
        # YTI TODO: Double holidays ?
        # YTI TODO: Students
        codes = {
            regular_gross: 1,
            rule_13th_month_gross: 2,
            termination_n: 7,
            termination_n1: 7,
            regular_car: 10,
            termination_fees: 4,
        }
        frequencies = {
            rule_13th_month_gross: 12
        }
        lines_by_code = defaultdict(lambda: self.env['hr.payslip.line'])
        for line in self.payslips.mapped('line_ids'):
            code = codes.get(line.salary_rule_id)
            if code:
                frequency = frequencies.get(line.salary_rule_id)
                lines_by_code[code, frequency] |= line
        return DMFARemuneration.init_multi([(lines, code, frequency) for (code, frequency), lines in lines_by_code.items()])

    def _prepare_occupation_informations(self):
        return DMFAOccupationInformation.init_multi([])


class DMFARemuneration(DMFANode):
    """
    Represents the paid amounts on payslips
    """
    def __init__(self, payslip_lines, code, frequency=None, sequence=1):
        super().__init__(payslip_lines.env, sequence=sequence)
        self.code = str(code).zfill(3)

        if frequency:
            self.frequency = str(frequency).zfill(2)
        else:
            self.frequency = -1

        self.amount = format_amount(sum(payslip_lines.mapped('total')))

        self.percentage_paid = -1

class DMFAOccupationInformation(DMFANode):
    """
    Represents the paid amounts on payslips
    """
    def __init__(self, sequence=1):
        super().__init__(self.payslips.env, sequence=sequence)

        self.display_info = False

        self.holiday_days_number = -1
        self.six_months_illness_date = -1
        self.maribel = -1
        self.horeca_extra = -1
        self.hour_remun = -1
        self.service_exemption_notion = -1
        self.hour_remun_thousandth = -1
        self.posted_employee = -1
        self.first_week_guaranteed_salary = -1
        self.illness_gross_remun = -1
        self.psddcl_exemption = -1
        self.suppl_pension_exemption = -1
        self.obligation_control = -1
        self.definitive_nomination_date = -1
        self.maribel_date = -1
        self.psp_contrib_derogation = -1
        self.career_measure = -1
        self.sector_detail = -1
        self.mobility_budget = -1
        self.flemish_training_hours = -1
        if self.display_info:
            # YTI TODO: Manage Flemish Training Hours work_entry_type_flemish_training_time_off
            self.flemish_training_hours = 400
            self.display_info = True
        self.regional_aid_measure = -1


class DMFAService(DMFANode):
    """
    Represents the worked hours/days
    """
    def __init__(self, worked_days, sequence=1):
        super().__init__(worked_days.env, sequence=sequence)
        if len(list(set(worked_days.mapped('work_entry_type_id.dmfa_code')))) > 1:
            raise ValueError("Cannot mix work of different types.")

        self.contract = worked_days.mapped('contract_id').sorted(key='date_start', reverse=True)[0]

        work_entry_type = worked_days[0].work_entry_type_id
        self.code = work_entry_type.dmfa_code.zfill(3)

        total_hours = sum(worked_days.mapped('number_of_days'))
        total_hours = round(total_hours * 2) / 2  # Round to half days
        self.nbr_days = format_amount(total_hours, width=5)

        if self.contract.time_credit or self.contract.resource_calendar_id.work_time_rate < 100:
            self.nbr_hours = format_amount(sum(worked_days.mapped('number_of_hours')), width=5)
        else:
            self.nbr_hours = -1

        self.flight_nbr_minutes = -1


class DMFAWorkerDeduction(DMFANode):

    def __init__(self, payslip_lines, code, sequence=1):
        super().__init__(payslip_lines.env, sequence=sequence)
        self.code = code
        self.deduction_calculation_basis = -1
        self.amount = format_amount(sum(payslip_lines.mapped('total')))
        # Could be required for other deductions: See ANNEXE 4
        self.deduction_right_starting_date = -1
        self.manager_cost_nbr_months = -1
        self.replace_inss = -1
        self.applicant_inss = -1
        self.certificate_origin = -1


class HrDMFAReport(models.Model):
    _name = 'l10n_be.dmfa'
    _description = 'DMFA xml report'
    _order = "year desc, quarter desc"

    name = fields.Char(compute='_compute_name', store=True)
    reference = fields.Char(required=True)
    company_id = fields.Many2one('res.company', required=True, default=lambda self: self.env.company)
    year = fields.Char(required=True, default=lambda self: fields.Date.today().year)
    quarter = fields.Selection([
        ('1', '1st'),
        ('2', '2nd'),
        ('3', '3rd'),
        ('4', '4th'),
    ], required=True, default=lambda self: str(date_utils.get_quarter_number(fields.Date.today())))
    dmfa_xml = fields.Binary(string="XML file")
    dmfa_xml_filename = fields.Char(compute='_compute_filename', store=True)
    quarter_start = fields.Date(compute='_compute_dates')
    quarter_end = fields.Date(compute='_compute_dates')
    validation_state = fields.Selection([
        ('normal', "N/A"),
        ('done', "Valid"),
        ('invalid', "Invalid"),
    ], default='normal', compute='_compute_validation_state', store=True)
    error_message = fields.Char(store=True, compute='_compute_validation_state', help="Technical error message")

    _sql_constraints = [
        ('_unique', 'unique (company_id, year, quarter)', "Only one DMFA per year and per quarter is allowed. Another one already exists."),
    ]

    @api.depends('reference', 'quarter', 'year')
    def _compute_name(self):
        for dmfa in self:
            dmfa.name = _('%s %s quarter %s') % (dmfa.reference, dmfa.quarter, dmfa.year)

    @api.constrains('year')
    def _check_year(self):
        for dmfa in self:
            try:
                int(dmfa.year)
            except ValueError:
                raise ValidationError(_("Field Year does not seem to be a year. It must be an integer."))

    @api.depends('dmfa_xml')
    def _compute_validation_state(self):
        dmfa_schema_file_path = get_resource_path(
            'l10n_be_hr_payroll',
            'data',
            'DmfAOriginal_20211.xsd',
        )
        xsd_root = etree.parse(dmfa_schema_file_path)
        schema = etree.XMLSchema(xsd_root)
        for dmfa in self:
            if not dmfa.dmfa_xml:
                dmfa.validation_state = 'normal'
                dmfa.error_message = False
            else:
                xml_root = etree.fromstring(base64.b64decode(dmfa.dmfa_xml))
                try:
                    schema.assertValid(xml_root)
                    dmfa.validation_state = 'done'
                except etree.DocumentInvalid as err:
                    dmfa.validation_state = 'invalid'
                    dmfa.error_message = str(err)

    @api.depends('dmfa_xml')
    def _compute_filename(self):
        # https://www.socialsecurity.be/site_fr/general/helpcentre/batch/files/directives.htm
        num_expedition = self.env["ir.config_parameter"].sudo().get_param("l10n_be.dmfa_expeditor_nbr", False)
        if not num_expedition:
            raise UserError(_('There is no defined expeditor number for the company.'))
        num_suite = str(self.id).zfill(5)
        now = fields.Date.today()
        # YTI TODO master: Add is_test field, to set R or T accordingly
        filename = 'FI.DMFA.%s.%s.%s.R.1.1.xml' % (num_expedition, now.strftime('%Y%m%d'), num_suite)
        for dmfa in self:
            dmfa.dmfa_xml_filename = filename

    @api.depends('year', 'quarter')
    def _compute_dates(self):
        for dmfa in self:
            year = int(dmfa.year)
            month = int(dmfa.quarter) * 3
            self.quarter_start, self.quarter_end = date_utils.get_quarter(date(year, month, 1))

    def generate_dmfa_report(self):
        # Sources:
        # Procedure: https://www.socialsecurity.be/site_fr/employer/applics/dmfa/batch/outline.htm
        # XML Specification: https://www.socialsecurity.be/site_fr/employer/applics/dmfa/batch/outline.htm
        # Flow Scheme DMFA: https://www.socialsecurity.be/site_fr/general/helpcentre/batch/files/fluxdmfa.htm
        # Structured Annexes: https://www.socialsecurity.be/lambda/portail/glossaires/bijlagen.nsf/web/Bijlagen_Home_Fr
        # General documentation: https://www.socialsecurity.be/site_fr/employer/general/techlib.htm#glossary
        # XML History: https://www.socialsecurity.be/lambda/portail/glossaires/dmfa.nsf/consult/fr/Xmlexport
        # PDF History: https://www.socialsecurity.be/lambda/portail/glossaires/dmfa.nsf/consult/fr/ImprPDF
        # Most related documentation: https://www.socialsecurity.be/lambda/portail/glossaires/dmfa.nsf/web/glossary_home_fr

        xml_str = self.env.ref('l10n_be_hr_payroll.dmfa_xml_report')._render(self._get_rendering_data())

        # Prettify xml string
        root = etree.fromstring(xml_str, parser=etree.XMLParser(remove_blank_text=True))
        xml_formatted_str = etree.tostring(root, pretty_print=True, encoding='utf-8', xml_declaration=True)

        self.dmfa_xml = base64.encodebytes(xml_formatted_str)

    def _get_rendering_data(self):
        payslips = self.env['hr.payslip'].search([
            # ('employee_id', 'in', employees.ids),
            ('date_to', '>=', self.quarter_start),
            ('date_to', '<=', self.quarter_end),
            ('state', 'in', ['done', 'paid']),
            ('company_id', '=', self.company_id.id),
        ])
        employees = payslips.mapped('employee_id')

        #### Preliminary Checks ####
        # Check Valid ONSS denominations
        if not self.company_id.dmfa_employer_class:
            raise ValidationError(_("Please provide an employer class for company %s. The employer class is given by the ONSS and should be encoded in the Payroll setting.", self.company_id.name))
        if not self.company_id.onss_registration_number and not self.company_id.onss_company_id:
            raise ValidationError(_("No ONSS registration number nor company ID was found for company %s. Please provide at least one.", self.company_id.name))
        # Check valid NISS
        invalid_employees = employees.filtered(lambda e: not e._is_niss_valid())
        if invalid_employees:
            raise UserError(_('Invalid NISS number for those employees:\n %s', '\n'.join(invalid_employees.mapped('name'))))
        # Check valid work addresses
        work_addresses = employees.mapped('address_id')
        location_units = self.env['l10n_be.dmfa.location.unit'].search([('partner_id', 'in', work_addresses.ids)])
        invalid_addresses = work_addresses - location_units.mapped('partner_id')
        if invalid_addresses:
            raise UserError(_('The following work addesses do not have any ONSS identification code:\n %s', '\n'.join(invalid_addresses.mapped('name'))))
        # Check valid work entry types
        work_entry_types = payslips.mapped('worked_days_line_ids.work_entry_type_id')
        invalid_types = work_entry_types.filtered(lambda t: not t.dmfa_code)
        if invalid_types:
            raise UserError(_('The following work entry types do not have any DMFA code set:\n %s', '\n'.join(invalid_types.mapped('name'))))

        employee_payslips = defaultdict(lambda: self.env['hr.payslip'])
        for payslip in payslips:
            employee_payslips[payslip.employee_id] |= payslip

        return {
            'employer_class': self.company_id.dmfa_employer_class,
            'onss_company_id': format_amount(self.company_id.onss_company_id or 0, width=10, hundredth=False),
            'onss_registration_number': format_amount(self.company_id.onss_registration_number or 0, width=9, hundredth=False),
            'quarter_repr': '%s%s' % (self.year, self.quarter),
            'quarter_start': self.quarter_start,
            'quarter_end': self.quarter_end,
            'data': self,
            'global_contribution': format_amount(self._get_global_contribution(payslips)),
            'system5': 0,
            'holiday_starting_date': -1,
            'natural_persons': DMFANaturalPerson.init_multi([(
                employee,
                employee_payslips[employee],
                self.quarter_start,
                self.quarter_end) for employee in employees]),
            'double_holiday_pay_contribution': format_amount(self._get_double_holiday_pay_contribution(payslips)),
            'unrelated_calculation_basis': -1,
        }

    def _get_global_contribution(self, payslips):
        """ Sum of all the owed contributions to ONSS"""
        lines = payslips.mapped('line_ids').filtered(lambda l: l.code == 'ONSSTOTAL')
        return sum(lines.mapped('total'))

    def _get_double_holiday_pay_contribution(self, payslips):
        """ Some contribution are not specified at the worker level but globally for the whole company """
        # Montant de la cotisation exeptionnelle (code 870)
        onss_double_holidays = self.env.ref('l10n_be_hr_payroll.cp200_employees_double_holiday_onss_rule') # <0
        onss_holiday_pay_n1 = self.env.ref('l10n_be_hr_payroll.cp200_employees_termination_n1_rules_special_contribution_onss_total') # >0
        onss_holiday_pay_n = self.env.ref('l10n_be_hr_payroll.cp200_employees_termination_n_rules_special_contribution_onss_total') # >0
        double_lines = payslips.mapped('line_ids').filtered(lambda l: l.salary_rule_id == onss_double_holidays)
        holiday_pay_lines = payslips.mapped('line_ids').filtered(lambda l: l.salary_rule_id in onss_holiday_pay_n1 + onss_holiday_pay_n)
        return -sum(double_lines.mapped('total')) + sum(holiday_pay_lines.mapped('total'))


class HrDMFALocationUnit(models.Model):
    _name = 'l10n_be.dmfa.location.unit'
    _description = 'Work Place defined by ONSS'
    _rec_name = 'code'

    code = fields.Integer(required=True)
    company_id = fields.Many2one('res.company', required=True, default=lambda self: self.env.company)
    partner_id = fields.Many2one('res.partner', string="Working Address", required=True)

    def _get_code(self):
        self.ensure_one()
        return self.code

    _sql_constraints = [
        ('_unique', 'unique (company_id, partner_id)', "A DMFA location cannot be set more than once for the same company and partner."),
    ]
