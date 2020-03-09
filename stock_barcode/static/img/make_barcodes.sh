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

barcode -t 3x7+20+35 -m 25x30 -p "210x297mm" -e code128b -n > barcodes_demo_barcode.ps  << BARCODES
WH/IN/00003
601647855638
O-BTN.validate
WH/OUT/00005
601647855644
O-BTN.validate
WH-RECEIPTS
601647855640
601647855631
LOT-000002
LOT-000003
O-BTN.validate
WH-DELIVERY
WH-RECEIPTS
WH-INTERNAL
WH-PICK
WH-PACK
PACK0000001
WH-STOCK
2601892
2601985
BARCODES

cat > barcodes_demo_header.ps << HEADER
/showLabel { /Helvetica findfont 14 scalefont setfont moveto show } def
/showTitle { /Helvetica findfont 11 scalefont setfont moveto show } def
(Receive products in stock) 45 797 showLabel
(WH/IN/00003) 45 777 showTitle
(Desk Stand with Screen) 230 777 showTitle
(Validate) 415 777 showTitle
(Deliver products to your customers) 45 687 showLabel
(WH/OUT/00005) 45 667 showTitle
(Desk Combination) 230 667 showTitle
(Validate) 415 667 showTitle
(Receive products tracked by lot number (activate Lots & Serial Numbers)) 45 577 showLabel
(YourCompany Receipts) 45 557 showTitle
(Corner Desk Black) 230 557 showTitle
(Cable Management Box) 415 557 showTitle
(LOT-000002) 45 447 showTitle
(LOT-000003) 230 447 showTitle
(Validate) 415 447 showTitle
(Operation types, locations and packs for YourCompany) 45 357 showLabel
(YourCompany Delivery) 45 337 showTitle
(YourCompany Receipts) 230 337 showTitle
(YourCompany Internal) 415 337 showTitle
(YourCompany Pick) 45 227 showTitle
(YourCompany Pack) 230 227 showTitle
(PACK0000001) 415 227 showTitle
(WH/Stock) 45 117 showTitle
(WH/Stock/Shelf 1) 230 117 showTitle
(WH/Stock/Shelf 2) 415 117 showTitle
HEADER

barcode -t 3x10+20+20 -m 25x15 -p "210x297mm" -e code128b -n > barcodes_demo_barcode_chicago.ps  << BARCODES
CHIC1-STOCK
CHIC1-DELIVERY
CHIC1-RECEIPTS
CHIC1-INTERNAL
CHIC1-PICK
CHIC1-PACK
CHIC2-DELIVERY
CHIC2-RECEIPTS
CHIC2-INTERNAL
CHIC2-PICK
CHIC2-PACK
BARCODES

cat > barcodes_demo_header_chicago.ps << HEADER
/showTitle { /Helvetica findfont 11 scalefont setfont moveto show } def
(Chick/Stock) 45 807 showTitle
(Chicago 1 Delivery) 230 807 showTitle
(Chicago 1 Receipts) 415 807 showTitle
(Chicago 1 Internal) 45 727 showTitle
(Chicago 1 Pick) 230 727 showTitle
(Chicago 1 Pack) 415 727 showTitle
(Chicago 2 Delivery) 45 647 showTitle
(Chicago 2 Receipts) 230 647 showTitle
(Chicago 2 Internal) 415 647 showTitle
(Chicago 2 Pick) 45 567 showTitle
(Chicago 2 Pack) 230 567 showTitle
HEADER

cat barcodes_demo_header.ps barcodes_demo_barcode.ps barcodes_demo_header_chicago.ps barcodes_demo_barcode_chicago.ps | ps2pdf - - > barcodes_demo.pdf
rm barcodes_demo_header.ps barcodes_demo_barcode.ps
rm barcodes_demo_header_chicago.ps barcodes_demo_barcode_chicago.ps
