odoo.define('web_studio.utils', function () {
"use strict";

 var COLORS = [
    '#FFFFFF',
    '#262c34',
    '#00dec9',
    '#2ecc71',
    '#f1c40f',
    '#FFAB4A',
    '#EB5A46',
    '#9b59b6',
    '#0079BF',
    '#4dd0e1',
];

 var BG_COLORS = [
    '#1abc9c',
    '#58a177',
    '#B4C259',
    '#56829f',
    '#636DA9',
    '#34495e',
    '#BC4242',
    '#C6572A',
    '#d49054',
    '#D89F45',
    '#DAB852',
    '#606060',
    '#6B6C70',
    '#838383',
    '#F5F5F5',
];

var ICONS = [
    'far fa-gem',
    'far fa-bell',
    'far fa-calendar-alt',
    'far fa-circle',
    'fa fa-cube',
    'fa fa-cubes',
    'far fa-flag',
    'fas fa-folder-open',
    'fa fa-home',
    'fa fa-rocket',
    'fa fa-sitemap',
    'fas fa-chart-area',
    'fa fa-balance-scale',
    'fa fa-database',
    'fa fa-globe-americas',
    'fas fa-university',
    'fas fa-random',
    'fa fa-umbrella',
    'fa fa-bed',
    'fa fa-bolt',
    'fas fa-comment-dots',
    'far fa-envelope',
    'fa fa-flask',
    'fa fa-magic',
    'fas fa-chart-pie',
    'fa fa-retweet',
    'fa fa-shopping-basket',
    'fas fa-star',
    'fas fa-tv',
    'fa fa-tree',
    'far fa-thumbs-up',
    'far fa-file',
    'fa fa-wheelchair',
    'fa fa-code',
    'fa fa-spinner',
    'fas fa-ticket-alt',
    'fas fa-shield-alt',
    'fa fa-recycle',
    'fa fa-phone',
    'fa fa-microphone',
    'fa fa-magnet',
    'fa fa-info',
    'fa fa-inbox',
    'fas fa-heart',
    'fa fa-bullseye',
    'fas fa-utensils',
    'far fa-credit-card',
    'fa fa-briefcase',
];

/**
 * @param {Integer} string_length
 * @returns {String} A random string with numbers and lower/upper case chars
 */
function randomString (string_length) {
    var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    var randomstring = '';
    for (var i=0; i<string_length; i++) {
        var rnum = Math.floor(Math.random() * chars.length);
        randomstring += chars.substring(rnum,rnum+1);
    }
    return randomstring;
}

return {
    COLORS: COLORS,
    BG_COLORS: BG_COLORS,
    ICONS: ICONS,
    randomString: randomString,
};
});
