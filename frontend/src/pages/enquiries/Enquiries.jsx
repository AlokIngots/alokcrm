import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { accountsApi } from '../accounts/api/accounts';
import { contactsApi } from '../contacts/api/contacts';
import { pipelineApi as dealsApi } from '../../modules/pipeline/api/pipelineApi';
import { userManager } from '../login/api/auth';
import { buildEnquiryKpis } from './kpi';
import { enquiriesApi } from '../../modules/enquiries/api/enquiriesApi';

const SALE_TYPES = [
  { id: 'LOCAL', label: 'Local' },
  { id: 'EXPORT', label: 'Export' },
];

const LOCAL_DROPDOWNS = {
  product: ['Bright Bar', 'Round Bar', 'Hex Bar', 'Square Bar', 'Flat Bar'],
  shape: ['ROUND', 'HEX', 'SQUARE', 'FLAT'],
  sizeMm: ['6', '8', '10', '12', '16', '20', '25', '30', '40', '50'],
  lengthMm: ['1000', '1500', '2000', '3000', '4000', '6000'],
  weight: ['Up to 50 kg', '50-200 kg', '200-500 kg', '500-1000 kg', '1000+ kg'],
  tolerance: ['h8', 'h9', 'h10'],
  heatTreatment: ['ANNEAL', 'NORMALIZE', 'QT', 'SOFT ANNEAL'],
  chamfering: ['None', 'Single Side', 'Double Side'],
  unit: ['kg', 'tons', 'pcs'],
  ultrasonicTest: ['Required', 'Not Required'],
  priceOffer: ['0.5', '1', '1.5', '2', '2.5', '3', '5', '7.5', '10', '12.5', '15'],
  priceUnit: ['INR/kg', 'USD/kg', 'EUR/kg'],
  paymentTerms: ['100% Advance', '30 Days', '45 Days', '60 Days'],
  orderProgress: ['Pending', 'Reviewed', 'Quoted', 'Won', 'Lost'],
};

const localDefault = {
  saleType: 'LOCAL',
  offerNo: '',
  followupDate: '',
  customerName: '',
  contactPerson: '',
  email: '',
  salesperson: '',
  phone: '',
  state: '',
  city: '',
  orderProgress: 'Pending',
  paymentTerms: '',
  packing: '',
  deliveryInstruction: '',
  port: '',
};

const defaultProductLine = {
  product: 'Bright Bar',
  shape: 'ROUND',
  grade: '',
  sizeMm: '12',
  lengthMm: '',
  heatTreatment: 'ANNEAL',
  tolerance: 'h9',
  chamfering: 'None',
  qty: '100',
  unit: 'kg',
  ultrasonicTest: 'Not Required',
  priceOffer: '1',
  priceUnit: 'INR/kg',
};

const getShapeFromProduct = (product) => {
  const value = String(product || '').trim().toLowerCase();
  if (value.includes('round')) return 'ROUND';
  if (value.includes('hex')) return 'HEX';
  if (value.includes('square')) return 'SQUARE';
  if (value.includes('flat')) return 'FLAT';
  if (value.includes('bright')) return 'ROUND';
  return 'ROUND';
};

const Enquiries = () => {
  const [showForm, setShowForm] = useState(false);
  const [saleType, setSaleType] = useState('LOCAL');
  const [localForm, setLocalForm] = useState(localDefault);
  const [productLines, setProductLines] = useState([{ ...defaultProductLine }]);
  const [enquiries, setEnquiries] = useState([]);
  const [isTableLoading, setIsTableLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [gradeOptions, setGradeOptions] = useState([]);
  const [toleranceOptions, setToleranceOptions] = useState([]);
  const [isMastersLoading, setIsMastersLoading] = useState(false);
  const [mastersError, setMastersError] = useState('');

  const rows = useMemo(() => enquiries, [enquiries]);
  const kpiCards = useMemo(() => buildEnquiryKpis(rows), [rows]);
  const gradeDatalistId = 'grade-options-master';
  const listIds = {
    product: 'product-options-master',
    sizeMm: 'size-options-master',
    lengthMm: 'length-options-master',
    heatTreatment: 'heat-treatment-options-master',
    tolerance: 'tolerance-options-master',
    chamfering: 'chamfering-options-master',
    unit: 'unit-options-master',
    ultrasonicTest: 'ut-options-master',
    priceOffer: 'price-offer-options-master',
    priceUnit: 'price-unit-options-master',
    paymentTerms: 'payment-terms-options-master',
    orderProgress: 'order-progress-options-master',
  };
  const getGradeOptionLabel = (grade) => {
    const code = (grade?.code || '').trim();
    const name = (grade?.name || '').trim();
    if (code && name && code !== name) return `${code} - ${name}`;
    return code || name;
  };
  const toleranceClassOptions = useMemo(() => {
    const classes = toleranceOptions.map((t) => t.class_code).filter(Boolean);
    const deduped = [...new Set(classes.map((c) => c.toLowerCase()))];
    return deduped.length > 0 ? deduped : LOCAL_DROPDOWNS.tolerance;
  }, [toleranceOptions]);

  useEffect(() => {
    const fetchMasters = async () => {
      if (!showForm) return;
      setIsMastersLoading(true);
      setMastersError('');
      try {
        const [grades, tolerances] = await Promise.all([
          enquiriesApi.getGradeMasters(1000),
          enquiriesApi.getToleranceMasters(),
        ]);
        setGradeOptions(Array.isArray(grades) ? grades : []);
        setToleranceOptions(Array.isArray(tolerances) ? tolerances : []);
      } catch (error) {
        setMastersError(error.message || 'Failed to load material masters');
      } finally {
        setIsMastersLoading(false);
      }
    };

    fetchMasters();
  }, [showForm]);

  const resetForms = () => {
    setLocalForm(localDefault);
    setProductLines([{ ...defaultProductLine }]);
    setSaleType('LOCAL');
  };

  const closeForm = () => {
    setShowForm(false);
    resetForms();
  };

  const mapEnquiryToRow = (enquiry) => {
    const firstItem = enquiry?.Items?.[0] || {};
    return {
      id: enquiry.id,
      saleType: enquiry.BusinessType || '-',
      company: enquiry.AccountName || '-',
      spec: `${firstItem.Grade || '-'} / ${firstItem.Dia || '-'} / ${firstItem.Qty || '-'}`,
      status: enquiry.Status || 'NEW',
      owner: enquiry.OwnerName || enquiry.OwnerECode || '-',
      followup: enquiry.NextFollowupDate || '-',
      pipelineSynced: true,
      raw: enquiry,
    };
  };

  const fetchEnquiries = useCallback(async () => {
    setIsTableLoading(true);
    try {
      const data = await enquiriesApi.getAllEnquiries();
      setEnquiries((Array.isArray(data) ? data : []).map(mapEnquiryToRow));
    } catch (error) {
      console.error('Error loading enquiries:', error);
    } finally {
      setIsTableLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEnquiries();
  }, [fetchEnquiries]);

  const createLocalRow = () => {
    const f = localForm;
    const primaryLine = productLines[0] || defaultProductLine;
    const currentUser = userManager.getUser();
    return {
      id: Date.now(),
      saleType: 'Local',
      company: f.customerName,
      spec: `${primaryLine.grade || '-'} / ${primaryLine.sizeMm || '-'} / ${primaryLine.qty || '-'} ${primaryLine.unit || ''}`,
      status: f.orderProgress || 'Pending',
      owner: currentUser?.Name || currentUser?.ECode || '-',
      followup: f.followupDate || '-',
      pipelineSynced: false,
      raw: f,
    };
  };

  const createExportRow = () => {
    const f = localForm;
    const primaryLine = productLines[0] || defaultProductLine;
    const currentUser = userManager.getUser();
    return {
      id: Date.now(),
      saleType: 'Export',
      company: f.customerName,
      spec: `${primaryLine.grade || '-'} / ${primaryLine.sizeMm || '-'} / ${primaryLine.qty || '-'} ${primaryLine.unit || ''}`,
      status: f.orderProgress || 'Pending',
      owner: currentUser?.Name || currentUser?.ECode || '-',
      followup: f.followupDate || '-',
      pipelineSynced: false,
      raw: f,
    };
  };

  const sanitizeEmail = (value, companyName = 'contact') => {
    const input = (value || '').trim().toLowerCase();
    if (input.includes('@')) return input;
    const safe = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 16) || 'contact';
    return `${safe}@alokingots.local`;
  };

  const toIsoDate = (value) => {
    const text = (value || '').trim();
    if (!text) return null;
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0];
  };

  const parsePositiveNumber = (value) => {
    const numeric = Number.parseFloat(String(value || '').replace(/,/g, '').trim());
    return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
  };

  const getOrCreateAccount = async ({ companyName, division, location, notes }) => {
    const allAccounts = await accountsApi.getAllAccounts();
    const target = (companyName || '').trim().toLowerCase();
    const existing = allAccounts.find((acc) => (acc.Name || '').trim().toLowerCase() === target);
    if (existing) return existing.id;

    const created = await accountsApi.createAccount({
      Name: companyName,
      Division: division,
      Location: location || null,
      Notes: notes
    });
    return created.id;
  };

  const getOrCreateContact = async ({ accountId, contactName, email, phone, notes }) => {
    const accountContacts = await contactsApi.getContactsByAccountId(accountId);
    const target = (contactName || '').trim().toLowerCase();
    const existing = accountContacts.find((c) => (c.Name || '').trim().toLowerCase() === target);
    if (existing) return existing.id;

    const created = await contactsApi.createContact({
      Name: contactName || 'Primary Contact',
      AccountID: accountId,
      Designation: 'Procurement',
      Email1: sanitizeEmail(email, contactName),
      Phone1: (phone || '').trim() || null,
      Notes: notes || null
    });
    return created.id;
  };

  const createDealFromEnquiry = async () => {
    const currentUser = userManager.getUser();
    const userECode = currentUser?.ECode;

    if (!userECode) {
      throw new Error('User session not found. Please login again.');
    }

    if (saleType === 'LOCAL') {
      const f = localForm;
      const primaryLine = productLines[0] || defaultProductLine;
      const companyName = (f.customerName || '').trim();
      if (!companyName) throw new Error('Customer Name is required to sync with Sales Pipeline.');

      const accountId = await getOrCreateAccount({
        companyName,
        division: 'TPT',
        location: [f.city, f.state].filter(Boolean).join(', '),
        notes: 'Auto-created from Local Enquiry form'
      });

      const contactId = await getOrCreateContact({
        accountId,
        contactName: (f.contactPerson || '').trim() || companyName,
        email: f.email,
        phone: f.phone,
        notes: 'Auto-created from Local Enquiry form'
      });

      const notes = [
        `Sale Type: Local`,
        `Offer No: ${f.offerNo || '-'}`,
        `Product Lines:`,
        ...productLines.map((line, idx) =>
          `${idx + 1}. ${line.product || '-'} | ${line.shape || '-'} | ${line.grade || '-'} | ${line.sizeMm || '-'}mm | L:${line.lengthMm || '-'} | HT:${line.heatTreatment || '-'} | Tol:${line.tolerance || '-'} | Chamfer:${line.chamfering || '-'} | Qty:${line.qty || '-'} ${line.unit || ''} | UT:${line.ultrasonicTest || '-'} | Price:${line.priceOffer || '-'} ${line.priceUnit || ''}`.trim()
        ),
        `Order Progress: ${f.orderProgress || '-'}`,
        `Commercial: Payment Terms=${f.paymentTerms || '-'}, Packing=${f.packing || '-'}, Delivery=${f.deliveryInstruction || '-'}`,
      ].join('\n');

      await dealsApi.createDeal({
        AccountID: accountId,
        ContactID: contactId,
        SalespersonECode: userECode,
        Division: 'TPT',
        ServiceType: `Local RFQ - ${primaryLine.product || primaryLine.shape || 'General'}`,
        DealValue: parsePositiveNumber(primaryLine.priceOffer),
        ExpectedClosureDate: toIsoDate(f.followupDate),
        LeadGeneratedBy: userECode,
        LeadSource: 'Inbound Inquiry',
        Stage: 'NEW',
        Notes: notes
      });
      return;
    }

    const f = localForm;
    const primaryLine = productLines[0] || defaultProductLine;
    const companyName = (f.customerName || '').trim();
    if (!companyName) throw new Error('Customer Name is required to sync with Sales Pipeline.');

    const accountId = await getOrCreateAccount({
      companyName,
      division: 'SCM',
      location: [f.city, f.state].filter(Boolean).join(', '),
      notes: 'Auto-created from Export Enquiry form'
    });

    const contactId = await getOrCreateContact({
      accountId,
      contactName: (f.contactPerson || '').trim() || companyName,
      email: f.email,
      phone: f.phone,
      notes: 'Auto-created from Export Enquiry form'
    });

    const notes = [
      `Sale Type: Export`,
      `Offer No: ${f.offerNo || '-'}`,
      `Product Lines:`,
      ...productLines.map((line, idx) =>
        `${idx + 1}. ${line.product || '-'} | ${line.shape || '-'} | ${line.grade || '-'} | ${line.sizeMm || '-'}mm | L:${line.lengthMm || '-'} | HT:${line.heatTreatment || '-'} | Tol:${line.tolerance || '-'} | Chamfer:${line.chamfering || '-'} | Qty:${line.qty || '-'} ${line.unit || ''} | UT:${line.ultrasonicTest || '-'} | Price:${line.priceOffer || '-'} ${line.priceUnit || ''}`.trim()
      ),
      `Order Progress: ${f.orderProgress || '-'}`,
      `Commercial: Payment Terms=${f.paymentTerms || '-'}, Packing=${f.packing || '-'}, Delivery=${f.deliveryInstruction || '-'}, Port=${f.port || '-'}`,
    ].join('\n');

    await dealsApi.createDeal({
      AccountID: accountId,
      ContactID: contactId,
      SalespersonECode: userECode,
      Division: 'SCM',
      ServiceType: `Export RFQ - ${primaryLine.product || primaryLine.shape || 'General'}`,
      DealValue: parsePositiveNumber(primaryLine.priceOffer),
      ExpectedClosureDate: toIsoDate(f.followupDate),
      LeadGeneratedBy: userECode,
      LeadSource: 'Client Reference',
      Stage: 'NEW',
      Notes: notes
    });
  };

  const validateEnquiryForm = () => {
    const errors = {};
    const primaryLine = productLines[0] || defaultProductLine;
    if (!['LOCAL', 'EXPORT'].includes(saleType)) errors.saleType = 'Choose Local or Export.';
    if (!localForm.customerName.trim()) errors.customerName = 'Customer Name is required.';
    if (!localForm.contactPerson.trim()) errors.contactPerson = 'Contact Person is required.';
    if (!localForm.followupDate) errors.followupDate = 'Follow-up Date is required.';
    if (!localForm.paymentTerms.trim()) errors.paymentTerms = 'Payment Terms is required.';
    if (saleType === 'EXPORT' && !localForm.port.trim()) errors.port = 'Port is required for Export enquiries.';
    if (!primaryLine.product.trim()) errors.product = 'Product is required.';
    if (!primaryLine.grade.trim()) errors.grade = 'Grade is required.';
    if (!primaryLine.sizeMm.trim()) errors.sizeMm = 'Size is required.';
    if (!primaryLine.heatTreatment.trim()) errors.heatTreatment = 'Heat Treatment is required.';
    if (!primaryLine.tolerance.trim()) errors.tolerance = 'Tolerance is required.';
    if (!String(primaryLine.qty).trim()) errors.qty = 'Qty is required.';
    if (!String(primaryLine.priceOffer).trim()) errors.priceOffer = 'Price Offer is required.';
    setFieldErrors(errors);
    return {
      isValid: Object.keys(errors).length === 0,
      firstError: Object.values(errors)[0] || ''
    };
  };

  const handleSaveEnquiry = async () => {
    setIsSaving(true);
    setSaveError('');
    setSaveSuccess('');

    const validation = validateEnquiryForm();
    if (!validation.isValid) {
      setSaveError(validation.firstError || 'Please complete required fields.');
      setIsSaving(false);
      return;
    }

    const newRow = saleType === 'LOCAL' ? createLocalRow() : createExportRow();
    setEnquiries((prev) => [newRow, ...prev]);

    try {
      await createDealFromEnquiry();
      setEnquiries((prev) =>
        prev.map((row) => (row.id === newRow.id ? { ...row, pipelineSynced: true } : row))
      );
      setSaveSuccess('Enquiry saved and synced to Sales Pipeline.');
      closeForm();
    } catch (error) {
      setSaveError(`Enquiry saved, but pipeline sync failed: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const generateOfferNo = (type = 'LOCAL') => {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const nextYy = String(now.getFullYear() + 1).slice(-2);
    const token = String(Date.now()).slice(-4);
    const label = type === 'EXPORT' ? 'EXPORT' : 'LOCAL';
    return `OFF-${token}/${label}/${yy}-${nextYy}`;
  };

  useEffect(() => {
    if (showForm) {
      setFieldErrors({});
      setLocalForm((prev) => ({
        ...prev,
        offerNo: generateOfferNo(saleType),
        salesperson: prev.salesperson || userManager.getUser()?.Name || ''
      }));
    }
  }, [showForm, saleType]);

  const getInputClass = (field) =>
    `border rounded-lg px-3 py-2 text-sm w-full ${
      fieldErrors[field] ? 'border-red-400 bg-red-50' : 'border-gray-300'
    }`;

  const updateProductLine = (index, key, value) => {
    setProductLines((prev) =>
      prev.map((line, i) => {
        if (i !== index) return line;
        if (key === 'product') {
          return {
            ...line,
            product: value,
            shape: getShapeFromProduct(value),
          };
        }
        return { ...line, [key]: value };
      })
    );
  };

  const addProductLine = () => {
    setProductLines((prev) => [...prev, { ...defaultProductLine }]);
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Enquiries (RFQ)</h1>
            <p className="text-gray-600 mt-1">Local sales inquiry + export offer capture in one workflow.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            New Enquiry
          </button>
        </div>
        {saveSuccess && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {saveSuccess}
          </div>
        )}
        {saveError && (
          <div className="mb-4 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
            {saveError}
          </div>
        )}

        <section className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
          {kpiCards.map((card) => (
            <div key={card.label} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <p className="text-sm text-gray-600">{card.label}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
            </div>
          ))}
        </section>

        <section className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Enquiry List</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sale Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Grade / Dia / Qty</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Owner</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Follow-up</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pipeline</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isTableLoading && (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-sm text-center text-gray-500">
                      Loading enquiries...
                    </td>
                  </tr>
                )}
                {!isTableLoading && rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-sm text-center text-gray-500">
                      No enquiries yet. Use "New Enquiry" to create your first RFQ.
                    </td>
                  </tr>
                )}
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-6 py-3 text-sm text-gray-700">{row.saleType}</td>
                    <td className="px-6 py-3 text-sm text-gray-900 font-medium">{row.company}</td>
                    <td className="px-6 py-3 text-sm text-gray-700">{row.spec}</td>
                    <td className="px-6 py-3 text-sm text-gray-700">{row.status}</td>
                    <td className="px-6 py-3 text-sm text-gray-700">{row.owner}</td>
                    <td className="px-6 py-3 text-sm text-gray-700">{row.followup}</td>
                    <td className="px-6 py-3 text-sm">
                      {row.pipelineSynced ? (
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                          Synced
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-1 text-xs font-medium text-orange-700">
                          Pending
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">Create New Enquiry</h3>
              <button onClick={closeForm} className="text-gray-500 hover:text-gray-700 text-lg">X</button>
            </div>

            <div className="p-6">
              {mastersError && (
                <div className="mb-4 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
                  {mastersError}
                </div>
              )}
              {isMastersLoading && (
                <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                  Loading grade and tolerance masters...
                </div>
              )}
              {(saleType === 'LOCAL' || saleType === 'EXPORT') && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Sale Type <span className="text-red-500">*</span></label>
                      <select
                        value={saleType}
                        onChange={(e) => {
                          setSaleType(e.target.value);
                          setFieldErrors((prev) => ({ ...prev, saleType: '' }));
                        }}
                        className={getInputClass('saleType')}
                      >
                        {SALE_TYPES.map((item) => (
                          <option key={item.id} value={item.id}>{item.label}</option>
                        ))}
                      </select>
                      {fieldErrors.saleType && <p className="mt-1 text-xs text-red-600">{fieldErrors.saleType}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Offer No. (auto)</label>
                      <input value={localForm.offerNo} readOnly className="w-full border border-gray-300 bg-gray-50 rounded-lg px-3 py-2 text-sm" />
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800 mb-3">Customer Details</h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <input value={localForm.customerName} onChange={(e) => {
                          setLocalForm((p) => ({ ...p, customerName: e.target.value }));
                          setFieldErrors((prev) => ({ ...prev, customerName: '' }));
                        }} placeholder="Customer Name *" className={getInputClass('customerName')} />
                        {fieldErrors.customerName && <p className="mt-1 text-xs text-red-600">{fieldErrors.customerName}</p>}
                      </div>
                      <div>
                        <input value={localForm.contactPerson} onChange={(e) => {
                          setLocalForm((p) => ({ ...p, contactPerson: e.target.value }));
                          setFieldErrors((prev) => ({ ...prev, contactPerson: '' }));
                        }} placeholder="Contact Person *" className={getInputClass('contactPerson')} />
                        {fieldErrors.contactPerson && <p className="mt-1 text-xs text-red-600">{fieldErrors.contactPerson}</p>}
                      </div>
                      <input type="email" value={localForm.email} onChange={(e) => setLocalForm((p) => ({ ...p, email: e.target.value }))} placeholder="Email" className={getInputClass('email')} />
                      <input value={localForm.salesperson} onChange={(e) => setLocalForm((p) => ({ ...p, salesperson: e.target.value }))} placeholder="Salesperson" className={getInputClass('salesperson')} />
                      <div>
                        <input type="date" value={localForm.followupDate} onChange={(e) => {
                          setLocalForm((p) => ({ ...p, followupDate: e.target.value }));
                          setFieldErrors((prev) => ({ ...prev, followupDate: '' }));
                        }} className={getInputClass('followupDate')} />
                        {fieldErrors.followupDate && <p className="mt-1 text-xs text-red-600">{fieldErrors.followupDate}</p>}
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-gray-800">Product Details</h4>
                      <button type="button" onClick={addProductLine} className="px-3 py-1.5 rounded bg-blue-600 text-white text-xs font-medium">
                        + Add Product Line
                      </button>
                    </div>
                    <div className="space-y-4">
                      {productLines.map((line, idx) => (
                        <div key={idx} className="border border-gray-200 rounded-lg p-3">
                          <p className="text-xs font-semibold text-gray-700 mb-3">Product Line {idx + 1}</p>
                          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                            <input list={listIds.product} value={line.product} onChange={(e) => {
                              updateProductLine(idx, 'product', e.target.value);
                              if (idx === 0) setFieldErrors((prev) => ({ ...prev, product: '' }));
                            }} placeholder="Select Product *" className={getInputClass('product')} />
                            <input
                              list={gradeDatalistId}
                              value={line.grade}
                              onChange={(e) => {
                                updateProductLine(idx, 'grade', e.target.value);
                                if (idx === 0) setFieldErrors((prev) => ({ ...prev, grade: '' }));
                              }}
                              placeholder="Type or Select Grade *"
                              className={getInputClass('grade')}
                            />
                            <input list={listIds.sizeMm} value={line.sizeMm} onChange={(e) => {
                              updateProductLine(idx, 'sizeMm', e.target.value);
                              if (idx === 0) setFieldErrors((prev) => ({ ...prev, sizeMm: '' }));
                            }} placeholder="Size (mm) *" className={getInputClass('sizeMm')} />
                            <input list={listIds.lengthMm} value={line.lengthMm} onChange={(e) => updateProductLine(idx, 'lengthMm', e.target.value)} placeholder="Length (mm)" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                            <input list={listIds.heatTreatment} value={line.heatTreatment} onChange={(e) => {
                              updateProductLine(idx, 'heatTreatment', e.target.value);
                              if (idx === 0) setFieldErrors((prev) => ({ ...prev, heatTreatment: '' }));
                            }} placeholder="Heat Treatment" className={getInputClass('heatTreatment')} />
                            <input list={listIds.tolerance} value={line.tolerance} onChange={(e) => {
                              updateProductLine(idx, 'tolerance', e.target.value);
                              if (idx === 0) setFieldErrors((prev) => ({ ...prev, tolerance: '' }));
                            }} placeholder="Tolerance" className={getInputClass('tolerance')} />
                            <input list={listIds.chamfering} value={line.chamfering} onChange={(e) => updateProductLine(idx, 'chamfering', e.target.value)} placeholder="Chamfering" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                            <input type="number" min="0" step="1" value={line.qty} onChange={(e) => {
                              updateProductLine(idx, 'qty', e.target.value);
                              if (idx === 0) setFieldErrors((prev) => ({ ...prev, qty: '' }));
                            }} placeholder="Qty *" className={getInputClass('qty')} />
                            <input list={listIds.unit} value={line.unit} onChange={(e) => updateProductLine(idx, 'unit', e.target.value)} placeholder="Unit" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                            <input list={listIds.ultrasonicTest} value={line.ultrasonicTest} onChange={(e) => updateProductLine(idx, 'ultrasonicTest', e.target.value)} placeholder="Ultrasonic Test" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                            <input list={listIds.priceOffer} value={line.priceOffer} onChange={(e) => {
                              updateProductLine(idx, 'priceOffer', e.target.value);
                              if (idx === 0) setFieldErrors((prev) => ({ ...prev, priceOffer: '' }));
                            }} placeholder="Price Offer *" className={getInputClass('priceOffer')} />
                            <input list={listIds.priceUnit} value={line.priceUnit} onChange={(e) => updateProductLine(idx, 'priceUnit', e.target.value)} placeholder="Price Unit" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                          </div>
                          {idx === 0 && (
                            <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
                              {['product', 'grade', 'sizeMm', 'heatTreatment', 'tolerance', 'qty', 'priceOffer'].map((key) =>
                                fieldErrors[key] ? (
                                  <p key={key} className="text-xs text-red-600">{fieldErrors[key]}</p>
                                ) : null
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800 mb-3">Commercial</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <input list={listIds.paymentTerms} value={localForm.paymentTerms} onChange={(e) => {
                          setLocalForm((p) => ({ ...p, paymentTerms: e.target.value }));
                          setFieldErrors((prev) => ({ ...prev, paymentTerms: '' }));
                        }} placeholder="Payment Terms *" className={getInputClass('paymentTerms')} />
                        {fieldErrors.paymentTerms && <p className="mt-1 text-xs text-red-600">{fieldErrors.paymentTerms}</p>}
                      </div>
                      <input value={localForm.packing} onChange={(e) => setLocalForm((p) => ({ ...p, packing: e.target.value }))} placeholder="Packing" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                      <input value={localForm.deliveryInstruction} onChange={(e) => setLocalForm((p) => ({ ...p, deliveryInstruction: e.target.value }))} placeholder="Delivery Instruction" className="md:col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                      {saleType === 'EXPORT' && (
                        <div>
                          <input
                            value={localForm.port}
                            onChange={(e) => {
                              setLocalForm((p) => ({ ...p, port: e.target.value }));
                              setFieldErrors((prev) => ({ ...prev, port: '' }));
                            }}
                            placeholder="Port *"
                            className={getInputClass('port')}
                          />
                          {fieldErrors.port && <p className="mt-1 text-xs text-red-600">{fieldErrors.port}</p>}
                        </div>
                      )}
                      <input list={listIds.orderProgress} value={localForm.orderProgress} onChange={(e) => setLocalForm((p) => ({ ...p, orderProgress: e.target.value }))} placeholder="Order Progress" className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                  </div>
                </div>
              )}

              <datalist id={gradeDatalistId}>
                {gradeOptions.map((g, index) => {
                  const optionValue = (g?.code || '').trim() || (g?.name || '').trim();
                  if (!optionValue) return null;
                  return (
                    <option
                      key={`${optionValue}-${index}`}
                      value={optionValue}
                      label={getGradeOptionLabel(g)}
                    />
                  );
                })}
              </datalist>
              <datalist id={listIds.product}>{LOCAL_DROPDOWNS.product.map((v) => <option key={v} value={v} />)}</datalist>
              <datalist id={listIds.sizeMm}>{LOCAL_DROPDOWNS.sizeMm.map((v) => <option key={v} value={v} />)}</datalist>
              <datalist id={listIds.lengthMm}>{LOCAL_DROPDOWNS.lengthMm.map((v) => <option key={v} value={v} />)}</datalist>
              <datalist id={listIds.heatTreatment}>{LOCAL_DROPDOWNS.heatTreatment.map((v) => <option key={v} value={v} />)}</datalist>
              <datalist id={listIds.tolerance}>{toleranceClassOptions.map((v) => <option key={v} value={String(v).toUpperCase()} />)}</datalist>
              <datalist id={listIds.chamfering}>{LOCAL_DROPDOWNS.chamfering.map((v) => <option key={v} value={v} />)}</datalist>
              <datalist id={listIds.unit}>{LOCAL_DROPDOWNS.unit.map((v) => <option key={v} value={v} />)}</datalist>
              <datalist id={listIds.ultrasonicTest}>{LOCAL_DROPDOWNS.ultrasonicTest.map((v) => <option key={v} value={v} />)}</datalist>
              <datalist id={listIds.priceOffer}>{LOCAL_DROPDOWNS.priceOffer.map((v) => <option key={v} value={v} />)}</datalist>
              <datalist id={listIds.priceUnit}>{LOCAL_DROPDOWNS.priceUnit.map((v) => <option key={v} value={v} />)}</datalist>
              <datalist id={listIds.paymentTerms}>{LOCAL_DROPDOWNS.paymentTerms.map((v) => <option key={v} value={v} />)}</datalist>
              <datalist id={listIds.orderProgress}>{LOCAL_DROPDOWNS.orderProgress.map((v) => <option key={v} value={v} />)}</datalist>

              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={closeForm} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEnquiry}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'Saving...' : 'Save Enquiry'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Enquiries;
