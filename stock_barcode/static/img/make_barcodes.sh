#!/bin/sh

barcode -t 2x7+40+40 -m 50x30 -p "210x297mm" -e code128b -n > barcodes_actions_barcode.ps << BARCODES
O-CMD.MAIN-MENU
O-CMD.DISCARD
O-BTN.validate
O-BTN.cancel
O-BTN.print-op
O-BTN.print-slip
O-BTN.pack
O-BTN.scrap
O-BTN.record-components
O-CMD.PREV
O-CMD.NEXT
O-CMD.PAGER-FIRST
O-CMD.PAGER-LAST
BARCODES

cat > barcodes_actions_header.ps << HEADER
/showTitle { /Helvetica findfont 12 scalefont setfont moveto show } def
(MAIN MENU) 89 768 showTitle
(DISCARD) 348 768 showTitle
(VALIDATE) 89 660 showTitle
(CANCEL) 348 660 showTitle
(PRINT PICKING OPERATION) 89 551 showTitle
(PRINT DELIVERY SLIP) 348 551 showTitle
(PUT IN PACK) 89 444 showTitle
(SCRAP) 348 444 showTitle
(RECORD COMPONENTS) 89 337 showTitle
(PREVIOUS PAGE) 348 337 showTitle
(NEXT PAGE) 89 230 showTitle
(FIRST PAGE) 348 230 showTitle
(LAST PAGE) 89 123 showTitle

HEADER

cat barcodes_actions_header.ps barcodes_actions_barcode.ps | ps2pdf - - > barcodes_actions.pdf
rm barcodes_actions_header.ps barcodes_actions_barcode.ps

barcode -t 3x10+20+20 -m 25x15 -p "210x297mm" -e code128b -n > barcodes_demo_barcode.ps  << BARCODES
601647855631
601647855640
601647855644
601647855638
LOC-01-00-00
LOC-01-01-00
LOC-01-01-01
LOC-01-02-00
PACK0000001
WH/OUT/00005
WH/IN/00003
LOT-000001
LOT-000002
WH-DELIVERY
WH-RECEIPTS
WH-INTERNAL
WH-PICK
WH-PACK
BARCODES

cat > barcodes_demo_header.ps << HEADER
/showTitle { /Helvetica findfont 11 scalefont setfont moveto show } def
(Cable Management Box) 45 807 showTitle
(Corner Desk Black) 230 807 showTitle
(Desk Combination) 415 807 showTitle
(Desk Stand with Screen) 45 727 showTitle
(WH/Stock) 230 727 showTitle
(WH/Stock/Shelf 1) 415 727 showTitle
(WH/Stock/Shelf 1/Small Refrigerator) 45 647 showTitle
(WH/Stock/Shelf 2) 230 647 showTitle
(PACK0000001) 415 647 showTitle
(WH/OUT/00005) 45 567 showTitle
(WH/IN/00003) 230 567 showTitle
(LOT-000001) 415 567 showTitle
(LOT-000002) 45 487 showTitle
(YourCompany delivery) 230 487 showTitle
(YourCompany receipts) 415 487 showTitle
(YourCompany internal) 45 407 showTitle
(YourCompany pick) 230 407 showTitle
(YourCompany pack) 415 407 showTitle
HEADER

barcode -t 3x10+20+20 -m 25x15 -p "210x297mm" -e code128b -n > barcodes_demo_barcode_chicago.ps  << BARCODES
LOC-02-00-00
CHIC-DELIVERY
CHIC-RECEIPTS
CHIC-INTERNAL
CHIC-PICK
CHIC-PACK
MYCO-DELIVERY
MYCO-RECEIPTS
MYCO-INTERNAL
MYCO-PICK
MYCO-PACK
BARCODES

cat > barcodes_demo_header_chicago.ps << HEADER
/showTitle { /Helvetica findfont 11 scalefont setfont moveto show } def
(Chick/Stock) 45 807 showTitle
(Chicago Delivery) 230 807 showTitle
(Chicago Receipts) 415 807 showTitle
(Chicago Internal) 45 727 showTitle
(Chicago Pick) 230 727 showTitle
(Chicago Pack) 415 727 showTitle
(My Company, Chicago Delivery) 45 647 showTitle
(My Company, Chicago Receipts) 230 647 showTitle
(My Company, Chicago Internal) 415 647 showTitle
(My Company, Chicago Pick) 45 567 showTitle
(My Company, Chicago Pack) 230 567 showTitle
HEADER

cat barcodes_demo_header.ps barcodes_demo_barcode.ps barcodes_demo_header_chicago.ps barcodes_demo_barcode_chicago.ps | ps2pdf - - > barcodes_demo.pdf
rm barcodes_demo_header.ps barcodes_demo_barcode.ps
rm barcodes_demo_header_chicago.ps barcodes_demo_barcode_chicago.ps
