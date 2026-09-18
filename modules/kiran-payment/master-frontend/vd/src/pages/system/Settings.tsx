import React, { useState } from 'react';
import { PageHeader } from '../../components/shell/PageHeader';
import {
  Building2,
  ShieldCheck,
  CreditCard,
  Bell,
  Sliders,
  CheckCircle2,
  Lock,
  Save,
  Key
} from 'lucide-react';

export const Settings: React.FC = () => {
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setToastMessage('System configurations and company profile saved successfully.');
    setTimeout(() => setToastMessage(null), 3500);
  };

  return (
    <div className="space-y-6 max-w-4xl animate-fadeIn pb-12">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-16 right-8 z-50 bg-ink text-white px-4 py-3 rounded-md shadow-popover border border-kiran flex items-center gap-2.5 text-xs animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-strand-green" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        title="System Settings & Company Master"
      />

      <form onSubmit={handleSave} className="space-y-6">
        {/* Company Master Card */}
        <div className="bg-surface border border-line rounded-lg p-6 shadow-card space-y-4">
          <div className="flex items-center gap-2 border-b border-line pb-3">
            <Building2 className="w-4 h-4 text-kiran" />
            <h3 className="font-display font-semibold text-sm text-ink">
              Corporate Legal Entity & Factory Master
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
            <div>
              <label className="block text-muted font-sans mb-1 font-semibold">Registered Company Name</label>
              <input
                type="text"
                defaultValue="KIRAN CABLE PROTECTION PRODUCTS PVT. LTD."
                className="w-full p-2 bg-canvas border border-line rounded text-ink font-semibold"
              />
            </div>
            <div>
              <label className="block text-muted font-sans mb-1 font-semibold">Brand / Trading Style</label>
              <input
                type="text"
                defaultValue="KIRAN / Kiran Udyog"
                className="w-full p-2 bg-canvas border border-line rounded text-ink font-semibold"
              />
            </div>
            <div>
              <label className="block text-muted font-sans mb-1 font-semibold">Corporate CIN Number</label>
              <input
                type="text"
                defaultValue="U31300TG1976PTC002014"
                className="w-full p-2 bg-canvas border border-line rounded text-ink font-semibold"
              />
            </div>
            <div>
              <label className="block text-muted font-sans mb-1 font-semibold">GSTIN Registration</label>
              <input
                type="text"
                defaultValue="36AAACK4921K1Z8"
                className="w-full p-2 bg-canvas border border-line rounded text-ink font-semibold"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-muted font-sans mb-1 font-semibold">Factory & Works Address</label>
              <input
                type="text"
                defaultValue="Plot 14/B, Industrial Development Area, Nacharam, Secunderabad - 500076, Telangana, India"
                className="w-full p-2 bg-canvas border border-line rounded text-ink font-sans"
              />
            </div>
          </div>
        </div>

        {/* Banking Metadata Card */}
        <div className="bg-surface border border-line rounded-lg p-6 shadow-card space-y-4">
          <div className="flex items-center gap-2 border-b border-line pb-3">
            <CreditCard className="w-4 h-4 text-strand-green" />
            <h3 className="font-display font-semibold text-sm text-ink">
              Official Letterhead Banking Credentials
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
            <div>
              <label className="block text-muted font-sans mb-1 font-semibold">Bank Name</label>
              <input
                type="text"
                defaultValue="HDFC Bank Ltd"
                className="w-full p-2 bg-canvas border border-line rounded text-ink font-semibold"
              />
            </div>
            <div>
              <label className="block text-muted font-sans mb-1 font-semibold">IFSC Code</label>
              <input
                type="text"
                defaultValue="HDFC0000045"
                className="w-full p-2 bg-canvas border border-line rounded text-ink font-semibold"
              />
            </div>
            <div>
              <label className="block text-muted font-sans mb-1 font-semibold">Current Account Number</label>
              <input
                type="text"
                defaultValue="50200012984511"
                className="w-full p-2 bg-canvas border border-line rounded text-ink font-semibold"
              />
            </div>
          </div>
        </div>

        {/* LLM & Cloud API Secrets Card */}
        <div className="bg-surface border border-line rounded-lg p-6 shadow-card space-y-4">
          <div className="flex items-center gap-2 border-b border-line pb-3">
            <Key className="w-4 h-4 text-ai" />
            <h3 className="font-display font-semibold text-sm text-ink">
              Anthropic Claude API & ERP Connectors
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
            <div>
              <label className="block text-muted font-sans mb-1 font-semibold">Anthropic API Key Status</label>
              <div className="p-2 bg-canvas border border-line rounded text-strand-green font-semibold flex items-center justify-between">
                <span>sk-ant-api03-live-prod••••••••••••</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-emerald-100 rounded text-emerald-900 font-sans">Active</span>
              </div>
            </div>
            <div>
              <label className="block text-muted font-sans mb-1 font-semibold">PACT ERP Host Connection</label>
              <div className="p-2 bg-canvas border border-line rounded text-ink font-semibold flex items-center justify-between">
                <span>pact-sql-srv.internal.kiranudyog.com:1433</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-blue-100 text-kiran rounded font-sans">Port 1433 OK</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="px-5 py-2 bg-kiran hover:bg-blue-700 text-white text-xs font-semibold rounded shadow-xs flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Settings Changes</span>
          </button>
        </div>
      </form>
    </div>
  );
};
