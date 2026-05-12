import React, { useState, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  collection, addDoc, query, where, getDocs, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { extractText, parseInvoiceText, generateThumbnail, generatePreview } from '../utils/ocrProcessor';
import { logAction } from '../utils/auditLogger';
import Toast, { useToast } from '../components/Toast';
import LoadingSpinner from '../components/LoadingSpinner';
import Sidebar from '../components/Sidebar';

// ── Add vendor names here as you collect them ──────────────
const VENDORS = [
  'East \'N\' West Cash & Carry',
  // Add more vendors below, one per line:
];

const STORES = ['Chase Side', 'Ley Street'];

const EMPTY_UPLOAD = {
  invoiceNumber: '', vendorName: '', invoiceDate: '',
  taxId: '', amount: '', tax: '', total: '', currency: 'GBP',
  store: '', paymentStatus: '', paymentMethod: '',
};

const EMPTY_MANUAL = {
  invoiceNumber: '', vendorName: '', invoiceDate: '',
  taxId: '', amount: '', tax: '', total: '',
  store: '', paymentStatus: '', paymentMethod: '',
};

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];

export default function InvoiceUpload() {
  const navigate = useNavigate();
  const { currentUser, userClaims, userData, logout } = useAuth();
  const { toast, showToast, clearToast } = useToast();

  const paidBy = userData?.fullName || userClaims?.username || currentUser?.email || '';

  const [mode, setMode] = useState('upload');

  // ── Upload mode state ─────────────────────────────────────
  const [file, setFile]               = useState(null);
  const [preview, setPreview]         = useState(null);
  const [isDragging, setIsDragging]   = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrRunning, setOcrRunning]   = useState(false);
  const [uploadForm, setUploadForm]   = useState(EMPTY_UPLOAD);
  const uploadFileRef = useRef(null);

  // ── Manual mode state ─────────────────────────────────────
  const [manualForm, setManualForm]         = useState(EMPTY_MANUAL);
  const [manualFile, setManualFile]         = useState(null);
  const manualFileRef = useRef(null);

  // ── Shared state ──────────────────────────────────────────
  const [saving, setSaving]       = useState(false);
  const [formErrors, setFormErrors] = useState({});

  // ── Mode switch — keeps each mode's data independent ─────
  function switchMode(m) {
    setMode(m);
    setFormErrors({});
  }

  // ── Upload mode: file selection ───────────────────────────
  function onFileSelected(selected) {
    if (!selected) return;
    if (!ALLOWED_TYPES.includes(selected.type)) {
      showToast('Only PDF, JPG, JPEG, and PNG files are allowed.', 'error');
      return;
    }
    if (selected.size > MAX_FILE_SIZE) {
      showToast('File size must be 20 MB or less.', 'error');
      return;
    }
    setFile(selected);
    setUploadForm(EMPTY_UPLOAD);
    setFormErrors({});
    if (selected.type.startsWith('image/')) {
      setPreview({ type: 'image', url: URL.createObjectURL(selected) });
    } else {
      setPreview({ type: 'pdf', name: selected.name });
    }
    runOCR(selected);
  }

  async function runOCR(f) {
    setOcrRunning(true);
    setOcrProgress(0);
    try {
      const text   = await extractText(f, setOcrProgress);
      const parsed = parseInvoiceText(text);
      setUploadForm((prev) => ({
        ...prev,
        ...Object.fromEntries(Object.entries(parsed).filter(([, v]) => v !== '')),
      }));
      showToast('Invoice data extracted. Please review before saving.', 'info');
    } catch {
      showToast('Could not extract text. Please fill in the fields manually.', 'warning');
    } finally {
      setOcrRunning(false);
      setOcrProgress(0);
    }
  }

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) onFileSelected(dropped);
  }, []);

  function handleUploadField(e) {
    const { name, value } = e.target;
    setUploadForm((f) => ({ ...f, [name]: value }));
    setFormErrors((errs) => ({ ...errs, [name]: undefined }));
  }

  // ── Manual mode: file attachment (filename only, not stored) ─
  function onManualFileSelected(selected) {
    if (!selected) return;
    if (!ALLOWED_TYPES.includes(selected.type)) {
      showToast('Only PDF, JPG, JPEG, and PNG files are allowed.', 'error');
      return;
    }
    setManualFile(selected);
  }

  function handleManualField(e) {
    const { name, value } = e.target;
    setManualForm((f) => ({ ...f, [name]: value }));
    setFormErrors((errs) => ({ ...errs, [name]: undefined }));
  }

  // ── Duplicate check ───────────────────────────────────────
  async function isDuplicate(invoiceNumber) {
    if (!invoiceNumber.trim()) return false;
    const snap = await getDocs(
      query(
        collection(db, 'invoices'),
        where('invoiceNumber', '==', invoiceNumber.trim()),
        where('createdBy', '==', currentUser.uid)
      )
    );
    return !snap.empty;
  }

  // ── Submit: upload mode ───────────────────────────────────
  async function handleUploadSubmit(e) {
    e.preventDefault();
    const errs = {};
    if (!uploadForm.invoiceNumber.trim()) errs.invoiceNumber = 'Invoice number is required.';
    if (!uploadForm.vendorName.trim())    errs.vendorName    = 'Vendor name is required.';
    if (!uploadForm.invoiceDate.trim())   errs.invoiceDate   = 'Invoice date is required.';
    if (!uploadForm.store)                errs.store         = 'Store is required.';
    if (!uploadForm.paymentStatus)                 errs.paymentStatus  = 'Payment status is required.';
    if (uploadForm.paymentStatus === 'Paid' && !uploadForm.paymentMethod)
      errs.paymentMethod = 'Payment method is required when paid.';
    if (uploadForm.amount && isNaN(Number(uploadForm.amount))) errs.amount = 'Must be a number.';
    if (uploadForm.tax    && isNaN(Number(uploadForm.tax)))    errs.tax    = 'Must be a number.';
    if (uploadForm.total  && isNaN(Number(uploadForm.total)))  errs.total  = 'Must be a number.';
    if (uploadForm.invoiceNumber.trim() && await isDuplicate(uploadForm.invoiceNumber))
      errs.invoiceNumber = 'This invoice number already exists.';
    if (Object.keys(errs).length) { setFormErrors(errs); return; }

    setSaving(true);
    try {
      const thumbnailBase64 = file ? await generateThumbnail(file) : '';
      const previewBase64   = file ? await generatePreview(file)   : '';
      const docRef = await addDoc(collection(db, 'invoices'), {
        invoiceNumber: uploadForm.invoiceNumber.trim(),
        vendorName:    uploadForm.vendorName.trim(),
        invoiceDate:   uploadForm.invoiceDate.trim(),
        taxId:         uploadForm.taxId.trim(),
        amount:        parseFloat(uploadForm.amount) || 0,
        tax:           parseFloat(uploadForm.tax)    || 0,
        total:         parseFloat(uploadForm.total)  || 0,
        currency:      'GBP',
        store:         uploadForm.store,
        paymentStatus: uploadForm.paymentStatus,
        paymentMethod: uploadForm.paymentStatus === 'Paid' ? uploadForm.paymentMethod : 'N/A',
        paidBy,
        thumbnailBase64,
        previewBase64,
        entryMode:     'upload',
        createdBy:     currentUser.uid,
        shopName:      userClaims?.shopName || '',
        createdAt:     serverTimestamp(),
      });
      await logAction({ action: 'INVOICE_UPLOADED', performedBy: currentUser.uid, performedByName: paidBy, targetId: docRef.id,
        details: { invoiceNumber: uploadForm.invoiceNumber, vendorName: uploadForm.vendorName } });
      showToast('Invoice saved!', 'success');
      setUploadForm(EMPTY_UPLOAD);
      setFile(null); setPreview(null);
      setTimeout(() => navigate('/invoices'), 1200);
    } catch (err) {
      showToast(err.message || 'Failed to save invoice.', 'error');
    } finally {
      setSaving(false);
    }
  }

  // ── Submit: manual mode ───────────────────────────────────
  async function handleManualSubmit(e) {
    e.preventDefault();
    const errs = {};
    if (!manualForm.vendorName.trim())  errs.vendorName  = 'Vendor name is required.';
    if (!manualForm.invoiceDate.trim()) errs.invoiceDate = 'Invoice date is required.';
    if (!manualForm.store)              errs.store       = 'Store is required.';
    if (!manualForm.paymentStatus)                errs.paymentStatus  = 'Payment status is required.';
    if (manualForm.paymentStatus === 'Paid' && !manualForm.paymentMethod)
      errs.paymentMethod = 'Payment method is required when paid.';
    if (!manualForm.total || isNaN(Number(manualForm.total)) || Number(manualForm.total) <= 0)
      errs.total = 'Total amount is required.';
    if (manualForm.amount && isNaN(Number(manualForm.amount))) errs.amount = 'Must be a number.';
    if (manualForm.tax    && isNaN(Number(manualForm.tax)))    errs.tax    = 'Must be a number.';
    if (Object.keys(errs).length) { setFormErrors(errs); return; }

    const goods = parseFloat(manualForm.amount) || 0;
    const vat   = parseFloat(manualForm.tax)    || 0;
    const total = parseFloat(manualForm.total);

    setSaving(true);
    try {
      const thumbnailBase64 = manualFile ? await generateThumbnail(manualFile) : '';
      const previewBase64   = manualFile ? await generatePreview(manualFile)   : '';
      const docRef = await addDoc(collection(db, 'invoices'), {
        invoiceNumber: manualForm.invoiceNumber.trim(),
        vendorName:    manualForm.vendorName.trim(),
        invoiceDate:   manualForm.invoiceDate.trim(),
        taxId:         manualForm.taxId.trim(),
        amount:        goods,
        tax:           vat,
        total,
        currency:      'GBP',
        store:         manualForm.store,
        paymentStatus: manualForm.paymentStatus,
        paymentMethod: manualForm.paymentStatus === 'Paid' ? manualForm.paymentMethod : 'N/A',
        paidBy,
        thumbnailBase64,
        previewBase64,
        attachmentName: manualFile?.name || '',
        entryMode:     'manual',
        createdBy:     currentUser.uid,
        shopName:      userClaims?.shopName || '',
        createdAt:     serverTimestamp(),
      });
      await logAction({ action: 'INVOICE_MANUAL', performedBy: currentUser.uid, performedByName: paidBy, targetId: docRef.id,
        details: { invoiceNumber: manualForm.invoiceNumber, vendorName: manualForm.vendorName, amount: total } });
      showToast('Invoice saved!', 'success');
      setManualForm(EMPTY_MANUAL);
      setManualFile(null);
      setTimeout(() => navigate('/invoices'), 1200);
    } catch (err) {
      showToast(err.message || 'Failed to save invoice.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="layout">
      <Toast {...toast} onClose={clearToast} />
      <Sidebar activePath="/invoices/upload" />

      <main className="main-content">
        <div className="page-header">
          <h2>Invoice Entry</h2>
        </div>

        <div className="mode-toggle">
          <button className={`mode-btn ${mode === 'upload' ? 'mode-btn--active' : ''}`} onClick={() => switchMode('upload')}>
            📎 Upload &amp; Extract
          </button>
          <button className={`mode-btn ${mode === 'manual' ? 'mode-btn--active' : ''}`} onClick={() => switchMode('manual')}>
            ✏️ Manual Entry
          </button>
        </div>

        {/* ── UPLOAD MODE ── */}
        {mode === 'upload' && (
          <>
            <p className="info-note" style={{ marginBottom: '16px' }}>
              Your file is read locally to extract invoice data. It is <strong>not uploaded or stored online</strong> — only the invoice details are saved.
            </p>
            <div className="upload-layout">
              <div className="upload-area-wrapper">
                <div
                  className={`drop-zone ${isDragging ? 'drop-zone--active' : ''} ${file ? 'drop-zone--filled' : ''}`}
                  onDrop={onDrop}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onClick={() => uploadFileRef.current.click()}
                >
                  {!file ? (
                    <>
                      <div className="drop-zone__icon">📂</div>
                      <p className="drop-zone__text">Drag &amp; drop a file here</p>
                      <p className="drop-zone__sub">or click to browse</p>
                      <p className="drop-zone__types">PDF · JPG · JPEG · PNG · Max 20 MB</p>
                    </>
                  ) : (
                    <div className="drop-zone__preview">
                      {preview?.type === 'image' && <img src={preview.url} alt="Invoice preview" className="preview-img" />}
                      {preview?.type === 'pdf' && <div className="preview-pdf"><span>📄</span><p>{preview.name}</p></div>}
                      <button className="btn btn--sm btn--danger preview-remove" onClick={(e) => {
                        e.stopPropagation();
                        setFile(null); setPreview(null); setUploadForm(EMPTY_UPLOAD);
                      }}>Remove</button>
                    </div>
                  )}
                  <input ref={uploadFileRef} type="file" accept=".pdf,.jpg,.jpeg,.png"
                    style={{ display: 'none' }} onChange={(e) => onFileSelected(e.target.files[0])} />
                </div>
                {ocrRunning && (
                  <div className="ocr-progress">
                    <div className="ocr-progress__bar" style={{ width: `${ocrProgress}%` }} />
                    <small>Extracting text… {ocrProgress}%</small>
                  </div>
                )}
              </div>

              <form onSubmit={handleUploadSubmit} className="invoice-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Invoice Number *</label>
                    <input name="invoiceNumber" value={uploadForm.invoiceNumber} onChange={handleUploadField} placeholder="INV-001" />
                    {formErrors.invoiceNumber && <span className="field-error">{formErrors.invoiceNumber}</span>}
                  </div>
                  <div className="form-group">
                    <label>Vendor Name *</label>
                    <input
                      name="vendorName"
                      list="vendor-list-upload"
                      value={uploadForm.vendorName}
                      onChange={handleUploadField}
                      placeholder="Select or type vendor name"
                      autoComplete="off"
                    />
                    <datalist id="vendor-list-upload">
                      {VENDORS.map((v) => <option key={v} value={v} />)}
                    </datalist>
                    {formErrors.vendorName && <span className="field-error">{formErrors.vendorName}</span>}
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Invoice Date *</label>
                    <input name="invoiceDate" type="date" value={uploadForm.invoiceDate} onChange={handleUploadField} />
                    {formErrors.invoiceDate && <span className="field-error">{formErrors.invoiceDate}</span>}
                  </div>
                  <div className="form-group">
                    <label>VAT Number</label>
                    <input name="taxId" value={uploadForm.taxId} onChange={handleUploadField} placeholder="GB 877 600 694" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Store *</label>
                    <select name="store" value={uploadForm.store} onChange={handleUploadField}>
                      <option value="">— Select store —</option>
                      {STORES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    {formErrors.store && <span className="field-error">{formErrors.store}</span>}
                  </div>
                  <div className="form-group">
                    <label>Payment Status *</label>
                    <select name="paymentStatus" value={uploadForm.paymentStatus} onChange={handleUploadField}>
                      <option value="">— Select status —</option>
                      <option value="Paid">Paid</option>
                      <option value="Unpaid">Unpaid</option>
                    </select>
                    {formErrors.paymentStatus && <span className="field-error">{formErrors.paymentStatus}</span>}
                  </div>
                  <div className="form-group">
                    <label>Payment Method *</label>
                    <select name="paymentMethod" value={uploadForm.paymentMethod}
                      onChange={handleUploadField} disabled={!uploadForm.paymentStatus || uploadForm.paymentStatus === 'Unpaid'}>
                      <option value="">— Select —</option>
                      <option value="Cash">Cash</option>
                      <option value="Card">Card</option>
                    </select>
                    {formErrors.paymentMethod && <span className="field-error">{formErrors.paymentMethod}</span>}
                  </div>
                </div>

              <div className="form-row form-row--3">
                  <div className="form-group">
                    <label>Goods (£)</label>
                    <input name="amount" type="number" step="0.01" value={uploadForm.amount} onChange={handleUploadField} placeholder="0.00" />
                    {formErrors.amount && <span className="field-error">{formErrors.amount}</span>}
                  </div>
                  <div className="form-group">
                    <label>VAT (£)</label>
                    <input name="tax" type="number" step="0.01" value={uploadForm.tax} onChange={handleUploadField} placeholder="0.00" />
                  </div>
                  <div className="form-group">
                    <label>Total (£)</label>
                    <input name="total" type="number" step="0.01" value={uploadForm.total} onChange={handleUploadField} placeholder="0.00" />
                    {formErrors.total && <span className="field-error">{formErrors.total}</span>}
                  </div>
                </div>
                <div className="form-actions">
                  <button type="submit" className="btn btn--primary" disabled={saving || ocrRunning}>
                    {saving ? <LoadingSpinner message="Saving…" /> : 'Save Invoice'}
                  </button>
                  <Link to="/invoices" className="btn btn--ghost">View My Invoices</Link>
                </div>
              </form>
            </div>
          </>
        )}

        {/* ── MANUAL ENTRY MODE ── */}
        {mode === 'manual' && (
          <div className="manual-entry-layout">
            <form onSubmit={handleManualSubmit} className="invoice-form invoice-form--manual">

              <div className="form-row">
                <div className="form-group">
                  <label>Invoice Number <span className="label-optional">(optional)</span></label>
                  <input name="invoiceNumber" value={manualForm.invoiceNumber} onChange={handleManualField}
                    placeholder="INV-001" />
                </div>
                <div className="form-group">
                  <label>Vendor Name *</label>
                  <input
                    name="vendorName"
                    list="vendor-list"
                    value={manualForm.vendorName}
                    onChange={handleManualField}
                    placeholder="Select or type vendor name"
                    autoComplete="off"
                  />
                  <datalist id="vendor-list">
                    {VENDORS.map((v) => <option key={v} value={v} />)}
                  </datalist>
                  {formErrors.vendorName && <span className="field-error">{formErrors.vendorName}</span>}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Invoice Date *</label>
                  <input name="invoiceDate" type="date" value={manualForm.invoiceDate} onChange={handleManualField} />
                  {formErrors.invoiceDate && <span className="field-error">{formErrors.invoiceDate}</span>}
                </div>
                <div className="form-group">
                  <label>VAT Number <span className="label-optional">(optional)</span></label>
                  <input name="taxId" value={manualForm.taxId} onChange={handleManualField}
                    placeholder="GB 877 600 694" />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Store *</label>
                  <select name="store" value={manualForm.store} onChange={handleManualField}>
                    <option value="">— Select store —</option>
                    {STORES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {formErrors.store && <span className="field-error">{formErrors.store}</span>}
                </div>
                <div className="form-group">
                  <label>Payment Status *</label>
                  <select name="paymentStatus" value={manualForm.paymentStatus} onChange={handleManualField}>
                    <option value="">— Select status —</option>
                    <option value="Paid">Paid</option>
                    <option value="Unpaid">Unpaid</option>
                  </select>
                  {formErrors.paymentStatus && <span className="field-error">{formErrors.paymentStatus}</span>}
                </div>
                <div className="form-group">
                  <label>Payment Method *</label>
                  <select name="paymentMethod" value={manualForm.paymentMethod}
                    onChange={handleManualField} disabled={!manualForm.paymentStatus || manualForm.paymentStatus === 'Unpaid'}>
                    <option value="">— Select —</option>
                    <option value="Cash">Cash</option>
                    <option value="Card">Card</option>
                  </select>
                  {formErrors.paymentMethod && <span className="field-error">{formErrors.paymentMethod}</span>}
                </div>
              </div>

              <div className="form-row form-row--3">
                <div className="form-group">
                  <label>Goods (£) <span className="label-optional">(optional)</span></label>
                  <input name="amount" type="number" step="0.01" min="0" value={manualForm.amount}
                    onChange={handleManualField} placeholder="0.00" />
                  {formErrors.amount && <span className="field-error">{formErrors.amount}</span>}
                </div>
                <div className="form-group">
                  <label>VAT (£) <span className="label-optional">(optional)</span></label>
                  <input name="tax" type="number" step="0.01" min="0" value={manualForm.tax}
                    onChange={handleManualField} placeholder="0.00" />
                  {formErrors.tax && <span className="field-error">{formErrors.tax}</span>}
                </div>
                <div className="form-group">
                  <label>Total (£) *</label>
                  <input name="total" type="number" step="0.01" min="0" value={manualForm.total}
                    onChange={handleManualField} placeholder="0.00" />
                  {formErrors.total && <span className="field-error">{formErrors.total}</span>}
                </div>
              </div>

              <div className="form-group">
                <label>Paid By</label>
                <input type="text" value={paidBy} readOnly className="input--readonly"
                  title="Automatically set to the logged-in user" />
              </div>

              <div className="form-group">
                <label>Attach Invoice File <span className="label-optional">(optional — generates thumbnail)</span></label>
                <div className="file-attach-row">
                  <button type="button" className="btn btn--ghost btn--sm"
                    onClick={() => manualFileRef.current.click()}>
                    📎 Choose File
                  </button>
                  {manualFile
                    ? <span className="file-attach-name">📄 {manualFile.name}
                        <button type="button" className="file-attach-remove"
                          onClick={() => { setManualFile(null); manualFileRef.current.value = ''; }}>✕</button>
                      </span>
                    : <span className="file-attach-hint">No file chosen</span>
                  }
                  <input ref={manualFileRef} type="file" accept=".pdf,.jpg,.jpeg,.png"
                    style={{ display: 'none' }} onChange={(e) => onManualFileSelected(e.target.files[0])} />
                </div>
              </div>

              <div className="form-actions">
                <button type="submit" className="btn btn--primary" disabled={saving}>
                  {saving ? <LoadingSpinner message="Saving…" /> : 'Save Invoice'}
                </button>
                <Link to="/invoices" className="btn btn--ghost">View My Invoices</Link>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}

