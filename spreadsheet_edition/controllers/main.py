import logging
import zipfile
import json
import io

from odoo import http
from odoo.exceptions import MissingError
from odoo.http import request, content_disposition, Controller

logger = logging.getLogger(__name__)


class SpreadsheetController(Controller):

    def _get_file_content(self, file_path):
        _, args = request.env['ir.http']._match(file_path)
        file_record = request.env['ir.binary']._find_record(
            xmlid=args.get('xmlid'),
            res_model=args.get('model', 'ir.attachment'),
            res_id=args.get('id'),
        )
        return request.env['ir.binary']._get_stream_from(file_record).read()

    def _generate_xlsx_content(self, files):
        stream = io.BytesIO()
        with zipfile.ZipFile(stream, 'w', compression=zipfile.ZIP_DEFLATED) as doc_zip:
            for f in files:
                # to reduce networking load, only the image path is sent.
                # It's replaced by the image content here.
                if 'imagePath' in f:
                    try:
                        content = self._get_file_content(f['imagePath'])
                        doc_zip.writestr(f['path'], content)
                    except MissingError:
                        pass
                else:
                    doc_zip.writestr(f['path'], f['content'])

        return stream.getvalue()

    @http.route('/spreadsheet/xlsx', type='http', auth="user", methods=["POST"])
    def get_xlsx_file(self, zip_name, files, **kw):
        files = json.loads(files)

        content = self._generate_xlsx_content(files)
        headers = [
            ('Content-Length', len(content)),
            ('Content-Type', 'application/vnd.ms-excel'),
            ('X-Content-Type-Options', 'nosniff'),
            ('Content-Disposition', content_disposition(zip_name))
        ]

        response = request.make_response(content, headers)
        return response
