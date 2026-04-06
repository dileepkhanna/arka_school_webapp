import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { apiClient } from "@/lib/apiClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Eye } from "lucide-react";

export interface ReceiptTemplate {
  schoolName: string;
  schoolAddress: string;
  schoolPhone: string;
  headerTitle: string;
  footerText: string;
  showAdmissionNumber: boolean;
  showClass: boolean;
  showDiscount: boolean;
  showLogo: boolean;
  logoUrl: string;
}

export const defaultTemplate: ReceiptTemplate = {
  schoolName: "",
  schoolAddress: "",
  schoolPhone: "",
  headerTitle: "FEE RECEIPT",
  footerText: "This is a computer-generated receipt.",
  showAdmissionNumber: true,
  showClass: true,
  showDiscount: true,
  showLogo: false,
  logoUrl: "",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export async function loadReceiptTemplate(): Promise<ReceiptTemplate> {
  const data = await apiClient.get<{ template: Record<string, any> }>(
    "/settings/receipt-template",
  );
  if (data?.template && typeof data.template === "object") {
    const sanitized = Object.fromEntries(
      Object.entries(data.template as Record<string, any>).filter(
        ([, value]) => value !== null && value !== undefined,
      ),
    );
    return { ...defaultTemplate, ...sanitized };
  }
  return defaultTemplate;
}

export default function ReceiptTemplateSettings({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const [template, setTemplate] = useState<ReceiptTemplate>(defaultTemplate);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setLoading(true);
      loadReceiptTemplate().then((t) => {
        setTemplate(t);
        setLoading(false);
      });
    }
  }, [open]);

  const update = (key: keyof ReceiptTemplate, value: any) => {
    setTemplate((prev) => ({ ...prev, [key]: value }));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const payload = new FormData();
      payload.append("logo", file);
      const data = await apiClient.postForm<{ logo_url: string }>(
        "/settings/receipt-template/logo",
        payload,
      );
      update("logoUrl", data.logo_url);
      update("showLogo", true);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error.message,
      });
    } finally {
      input.value = "";
      setUploading(false);
    }
  };

  const openLogoPicker = () => {
    logoInputRef.current?.click();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.put("/settings/receipt-template", { template });
      toast({
        title: "Saved",
        description: "Receipt template updated successfully",
      });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            Receipt Template Settings
          </DialogTitle>
          <DialogDescription>
            Configure the receipt header, visible fields, and receipt logo.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* School Info */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                School Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="schoolName">School Name</Label>
                  <Input
                    id="schoolName"
                    value={template.schoolName}
                    onChange={(e) => update("schoolName", e.target.value)}
                    placeholder="e.g. ASE School"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="schoolPhone">Phone</Label>
                  <Input
                    id="schoolPhone"
                    value={template.schoolPhone}
                    onChange={(e) => update("schoolPhone", e.target.value)}
                    placeholder="+91..."
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="schoolAddress">Address</Label>
                <Input
                  id="schoolAddress"
                  value={template.schoolAddress}
                  onChange={(e) => update("schoolAddress", e.target.value)}
                  placeholder="Full address"
                />
              </div>
            </div>

            <Separator />

            {/* Header / Footer */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Header & Footer
              </h3>
              <div className="space-y-1">
                <Label htmlFor="headerTitle">Header Title</Label>
                <Input
                  id="headerTitle"
                  value={template.headerTitle}
                  onChange={(e) => update("headerTitle", e.target.value)}
                  placeholder="FEE RECEIPT"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="footerText">Footer Text</Label>
                <Textarea
                  id="footerText"
                  value={template.footerText}
                  onChange={(e) => update("footerText", e.target.value)}
                  rows={2}
                  placeholder="Footer note..."
                />
              </div>
            </div>

            <Separator />

            {/* Logo */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Logo
              </h3>
              <div className="flex items-center justify-between">
                <Label>Show Logo on Receipt</Label>
                <Switch
                  checked={template.showLogo}
                  onCheckedChange={(v) => update("showLogo", v)}
                />
              </div>
              {template.showLogo && (
                <div className="flex items-center gap-4">
                  {template.logoUrl && (
                    <img
                      src={template.logoUrl}
                      alt="Logo"
                      className="h-12 w-12 rounded object-contain border"
                    />
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={openLogoPicker}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {template.logoUrl ? "Change Logo" : "Upload Logo"}
                  </Button>
                  <input
                    ref={logoInputRef}
                    id="logoUpload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                </div>
              )}
            </div>

            <Separator />

            {/* Field Toggles */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Visible Fields
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Admission Number</Label>
                  <Switch
                    checked={template.showAdmissionNumber}
                    onCheckedChange={(v) => update("showAdmissionNumber", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Class</Label>
                  <Switch
                    checked={template.showClass}
                    onCheckedChange={(v) => update("showClass", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Discount Column</Label>
                  <Switch
                    checked={template.showDiscount}
                    onCheckedChange={(v) => update("showDiscount", v)}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Preview */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Eye className="h-4 w-4" /> Preview
              </h3>
              <div className="border rounded-lg p-5 bg-white text-sm space-y-3 text-black">
                {/* Logo centered on top */}
                {template.showLogo && template.logoUrl && (
                  <div className="flex justify-center">
                    <img
                      src={template.logoUrl}
                      alt="Logo"
                      className="h-14 w-14 rounded object-contain"
                    />
                  </div>
                )}

                {/* School info centered below logo */}
                <div className="text-center">
                  {template.schoolName && (
                    <p className="font-bold text-base">{template.schoolName}</p>
                  )}
                  {template.schoolAddress && (
                    <p className="text-xs text-gray-500">
                      {template.schoolAddress}
                    </p>
                  )}
                  {template.schoolPhone && (
                    <p className="text-xs text-gray-500">
                      Ph: {template.schoolPhone}
                    </p>
                  )}
                </div>

                {/* Title */}
                <p className="font-bold text-sm tracking-wide text-center">
                  {template.headerTitle || "FEE RECEIPT"}
                </p>

                {/* Separator */}
                <hr className="border-gray-300" />

                {/* Receipt meta */}
                <div className="flex justify-between text-xs">
                  <span>
                    Receipt No: <span className="font-mono">RCP12345678</span>
                  </span>
                  <span>Date: {new Date().toLocaleDateString()}</span>
                </div>

                {/* Student info */}
                <div className="text-xs space-y-0.5">
                  <p>
                    Student: <strong>Sample Student</strong>
                  </p>
                  {template.showAdmissionNumber && (
                    <p>
                      Admission No: <span className="font-mono">ADM001</span>
                    </p>
                  )}
                  {template.showClass && <p>Class: 10-A</p>}
                </div>

                {/* Table matching PDF style */}
                <table className="w-full text-xs border border-gray-300">
                  <thead>
                    <tr className="bg-[#2980b3] text-white">
                      <th className="p-1.5 text-left border border-gray-300">
                        Fee Type
                      </th>
                      <th className="p-1.5 text-center border border-gray-300">
                        Amount (Rs.)
                      </th>
                      {template.showDiscount && (
                        <th className="p-1.5 text-center border border-gray-300">
                          Discount (Rs.)
                        </th>
                      )}
                      <th className="p-1.5 text-center border border-gray-300">
                        Net (Rs.)
                      </th>
                      <th className="p-1.5 text-center border border-gray-300">
                        Paid (Rs.)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="p-1.5 text-left border border-gray-300">
                        Tuition
                      </td>
                      <td className="p-1.5 text-center border border-gray-300">
                        10,000
                      </td>
                      {template.showDiscount && (
                        <td className="p-1.5 text-center border border-gray-300">
                          500
                        </td>
                      )}
                      <td className="p-1.5 text-center border border-gray-300">
                        9,500
                      </td>
                      <td className="p-1.5 text-center border border-gray-300">
                        9,500
                      </td>
                    </tr>
                  </tbody>
                </table>

                {template.footerText && (
                  <p className="text-xs text-center text-gray-400 italic pt-2">
                    {template.footerText}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
