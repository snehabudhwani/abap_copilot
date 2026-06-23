*&---------------------------------------------------------------------*
*& Report ZSD_INVOICE_PROC
*& Builds an invoice worklist from sales documents and pricing.
*& (Synthetic sample for S/4HANA readiness scanning — not production code)
*&---------------------------------------------------------------------*
REPORT zsd_invoice_proc.

TABLES: vbak.

DATA: lt_konv  TYPE TABLE OF konv,
      lt_items TYPE TABLE OF vbap OCCURS 0 WITH HEADER LINE.

PARAMETERS: p_vkorg TYPE vbak-vkorg.

START-OF-SELECTION.

* Read all sales order headers for the org
  SELECT * FROM vbak
    INTO TABLE @DATA(lt_orders)
    WHERE vkorg = @p_vkorg.

* Pick the "first" billing-relevant header (relies on implicit order)
  SELECT SINGLE vbeln knumv
    FROM vbak
    INTO (@DATA(lv_vbeln), @DATA(lv_knumv)).

* Read pricing conditions directly from KONV (renamed in S/4HANA)
  SELECT * FROM konv
    INTO TABLE lt_konv
    WHERE knumv = lv_knumv.

* Read overall processing status from removed status table VBUK
  SELECT * FROM vbuk
    INTO TABLE @DATA(lt_status)
    WHERE vbeln = lv_vbeln.

* Classic list output (SAP GUI only — not Fiori-ready)
  WRITE: / 'Invoice worklist for', p_vkorg.
  TOP-OF-PAGE.
  WRITE: / 'VBELN', 15 'NET VALUE'.

  LOOP AT lt_orders INTO DATA(ls_order).
    WRITE: / ls_order-vbeln, 15 ls_order-netwr.
  ENDLOOP.
