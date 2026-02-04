import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Upload, Save, Edit, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import useFetch from "@/hooks/useFetch";
import { usePatch } from "@/hooks/usePatch";
import { usePost } from "@/hooks/usePost";
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

export function CompanySettings() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);

  const { data: companyData, isLoading: isFetching } = useFetch("api/company/profile/");

  const [formData, setFormData] = useState({
    company_name: "",
    registration_number: "",
    vat_number: "",
    industry: "logistics",
    website: "",
    description: "",
    logo_url: "",
    address: {
      street: "",
      city: "",
      province: "",
      postal_code: "",
      country: "South Africa"
    },
    contact: {
      phone: "",
      email: "",
      support_email: ""
    }
  });

  useEffect(() => {
    if (companyData) {
      setFormData({
        company_name: companyData.company_name || "",
        registration_number: companyData.registration_number || "",
        vat_number: companyData.vat_number || "",
        industry: companyData.industry || "logistics",
        website: companyData.website || "",
        description: companyData.description || "",
        logo_url: companyData.logo_url || "",
        address: {
          street: companyData.address?.street || "",
          city: companyData.address?.city || "",
          province: companyData.address?.province || "",
          postal_code: companyData.address?.postal_code || "",
          country: companyData.address?.country || "South Africa"
        },
        contact: {
          phone: companyData.contact?.phone || "",
          email: companyData.contact?.email || "",
          support_email: companyData.contact?.support_email || ""
        }
      });
    }
  }, [companyData]);

  const { mutate: updateProfile, isPending: isUpdating } = usePatch({
    onSuccess: () => {
      toast.success("Company details updated successfully");
      queryClient.invalidateQueries({ queryKey: ["api/company/profile/"] });
      setIsEditing(false);
    },
    onError: () => {
      toast.error("Failed to update company details");
    },
  });

  const { mutate: uploadLogo, isPending: isUploading } = usePost({
    onSuccess: (data) => {
      toast.success("Logo uploaded successfully");
      setFormData(prev => ({ ...prev, logo_url: data.logo_url }));
      queryClient.invalidateQueries({ queryKey: ["api/company/profile/"] });
    },
    onError: () => {
      toast.error("Failed to upload logo");
    },
  });

  const handleSave = () => {
    updateProfile({ url: "api/company/profile/", data: formData });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const uploadData = new FormData();
      uploadData.append('logo', file);
      uploadLogo({
        url: "api/company/logo/",
        data: uploadData,
        config: {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      });
    }
  };

  const handleChange = (field: string, value: string, nested?: string) => {
    if (nested) {
      setFormData(prev => ({
        ...prev,
        [nested]: {
          ...prev[nested as keyof typeof prev] as any,
          [field]: value
        }
      }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-heading text-foreground">Company Details</h1>
        <p className="text-caption text-muted-foreground">
          Manage your company information and branding settings
        </p>
      </div>

      {/* Company Logo */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-body-medium">Company Logo</CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center overflow-hidden border border-border">
              {formData.logo_url ? (
                <img
                  src={formData.logo_url}
                  alt="Company Logo"
                  className="w-full h-full object-contain p-2"
                />
              ) : (
                <Building2 className="w-8 h-8 text-muted-foreground" />
              )}
            </div>
            <div className="space-y-1">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleLogoUpload}
              />
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {isUploading ? "Uploading..." : "Upload New Logo"}
              </Button>
              <p className="text-caption text-muted-foreground">
                SVG, PNG or JPG. Max size 2MB.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Basic Information */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-body-medium">
              <Building2 className="w-4 h-4" />
              Basic Information
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
              className="gap-2"
            >
              {isEditing ? <X className="w-4 h-4" /> : <Edit className="w-4 h-4" />}
              {isEditing ? 'Cancel' : 'Edit'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-3">
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="company_name" className="text-caption text-muted-foreground">Company Name</Label>
              <Input
                id="company_name"
                value={formData.company_name}
                readOnly={!isEditing}
                onChange={(e) => handleChange('company_name', e.target.value)}
                className={`text-body ${!isEditing ? "bg-muted/30" : ""}`}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="registration_number" className="text-caption text-muted-foreground">Registration Number</Label>
                <Input
                  id="registration_number"
                  value={formData.registration_number}
                  readOnly={!isEditing}
                  onChange={(e) => handleChange('registration_number', e.target.value)}
                  className={`text-body ${!isEditing ? "bg-muted/30" : ""}`}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="vat_number" className="text-caption text-muted-foreground">VAT Number</Label>
                <Input
                  id="vat_number"
                  value={formData.vat_number}
                  readOnly={!isEditing}
                  onChange={(e) => handleChange('vat_number', e.target.value)}
                  className={`text-body ${!isEditing ? "bg-muted/30" : ""}`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="industry" className="text-caption text-muted-foreground">Industry</Label>
                {isEditing ? (
                  <Select value={formData.industry} onValueChange={(value) => handleChange('industry', value)}>
                    <SelectTrigger className="text-body">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="logistics">Logistics & Transportation</SelectItem>
                      <SelectItem value="freight">Freight Forwarding</SelectItem>
                      <SelectItem value="supply-chain">Supply Chain</SelectItem>
                      <SelectItem value="warehousing">Warehousing</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value="Logistics & Transportation"
                    readOnly
                    className="text-body bg-muted/30"
                  />
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="website" className="text-caption text-muted-foreground">Website</Label>
                <Input
                  id="website"
                  value={formData.website}
                  readOnly={!isEditing}
                  onChange={(e) => handleChange('website', e.target.value)}
                  className={`text-body ${!isEditing ? "bg-muted/30" : ""}`}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="description" className="text-caption text-muted-foreground">Company Description</Label>
              <Textarea
                id="description"
                rows={2}
                value={formData.description}
                readOnly={!isEditing}
                onChange={(e) => handleChange('description', e.target.value)}
                className={`text-body ${!isEditing ? "bg-muted/30" : ""}`}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Business Address */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-body-medium">Business Address</CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="street" className="text-caption text-muted-foreground">Street Address</Label>
              <Input
                id="street"
                value={formData.address.street}
                readOnly={!isEditing}
                onChange={(e) => handleChange('street', e.target.value, 'address')}
                className={`text-body ${!isEditing ? "bg-muted/30" : ""}`}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label htmlFor="city" className="text-caption text-muted-foreground">City</Label>
                <Input
                  id="city"
                  value={formData.address.city}
                  readOnly={!isEditing}
                  onChange={(e) => handleChange('city', e.target.value, 'address')}
                  className={`text-body ${!isEditing ? "bg-muted/30" : ""}`}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="province" className="text-caption text-muted-foreground">Province</Label>
                {isEditing ? (
                  <Select
                    value={formData.address.province}
                    onValueChange={(value) => handleChange('province', value, 'address')}
                  >
                    <SelectTrigger className="text-body">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Gauteng">Gauteng</SelectItem>
                      <SelectItem value="Western Cape">Western Cape</SelectItem>
                      <SelectItem value="KwaZulu-Natal">KwaZulu-Natal</SelectItem>
                      <SelectItem value="Eastern Cape">Eastern Cape</SelectItem>
                      <SelectItem value="Free State">Free State</SelectItem>
                      <SelectItem value="Limpopo">Limpopo</SelectItem>
                      <SelectItem value="Mpumalanga">Mpumalanga</SelectItem>
                      <SelectItem value="North West">North West</SelectItem>
                      <SelectItem value="Northern Cape">Northern Cape</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={formData.address.province}
                    readOnly
                    className="text-body bg-muted/30"
                  />
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="postal_code" className="text-caption text-muted-foreground">Postal Code</Label>
                <Input
                  id="postal_code"
                  value={formData.address.postal_code}
                  readOnly={!isEditing}
                  onChange={(e) => handleChange('postal_code', e.target.value, 'address')}
                  className={`text-body ${!isEditing ? "bg-muted/30" : ""}`}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact Information */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-body-medium">Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="phone" className="text-caption text-muted-foreground">Phone Number</Label>
                <Input
                  id="phone"
                  value={formData.contact.phone}
                  readOnly={!isEditing}
                  onChange={(e) => handleChange('phone', e.target.value, 'contact')}
                  className={`text-body ${!isEditing ? "bg-muted/30" : ""}`}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="email" className="text-caption text-muted-foreground">General Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.contact.email}
                  readOnly={!isEditing}
                  onChange={(e) => handleChange('email', e.target.value, 'contact')}
                  className={`text-body ${!isEditing ? "bg-muted/30" : ""}`}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="support_email" className="text-caption text-muted-foreground">Support Email</Label>
              <Input
                id="support_email"
                type="email"
                value={formData.contact.support_email}
                readOnly={!isEditing}
                onChange={(e) => handleChange('support_email', e.target.value, 'contact')}
                className={`text-body max-w-md ${!isEditing ? "bg-muted/30" : ""}`}
              />
            </div>
          </div>

          {isEditing && (
            <div className="flex gap-2 pt-3 mt-3 border-t border-border">
              <Button onClick={handleSave} disabled={isUpdating} className="gap-2" size="sm">
                <Save className="w-4 h-4" />
                {isUpdating ? "Saving..." : "Save Changes"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}