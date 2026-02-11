import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { User, Camera, Save } from "lucide-react";
import { toast } from "sonner";
import useFetch from "@/hooks/useFetch";
import { usePatch } from "@/hooks/usePatch";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { tokenStorage } from "@/lib/tokenStorage";

export function ProfileSettings() {
  const queryClient = useQueryClient();
  const { data: profileData, isLoading: isFetching } = useFetch("api/auth/me/");

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    job_title: "",
    phone: "",
    timezone: "Africa/Johannesburg",
    language: "en",
    date_format: "DD/MM/YYYY"
  });

  useEffect(() => {
    if (profileData) {
      setFormData({
        first_name: profileData.first_name || "",
        last_name: profileData.last_name || "",
        email: profileData.email || "",
        job_title: profileData.job_title || "",
        phone: profileData.phone || "",
        timezone: profileData.timezone || "Africa/Johannesburg",
        language: profileData.language || "en",
        date_format: profileData.date_format || "DD/MM/YYYY"
      });
    }
  }, [profileData]);

  const { mutate: updateProfile, isPending: isUpdating } = usePatch({
    onSuccess: (data) => {
      toast.success("Profile updated successfully");
      queryClient.invalidateQueries({ queryKey: ["api/auth/me/"] });
      // Update session storage for sidebar
      const user = tokenStorage.getUser();
      if (user) {
        tokenStorage.setUser({ ...user, ...data });
        window.dispatchEvent(new Event('storage'));
      }
    },
    onError: () => {
      toast.error("Failed to update profile");
    },
  });

  const handleSave = () => {
    updateProfile({ url: "api/auth/me/", data: formData });
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (isFetching) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-heading text-foreground">Profile Settings</h1>
        <p className="text-caption text-muted-foreground">
          Manage your personal information and account preferences
        </p>
      </div>

      {/* Profile Picture */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-body-medium">
            <User className="w-4 h-4" />
            Profile Picture
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center gap-4">
            <Avatar className="w-16 h-16">
              <AvatarImage src="/placeholder-avatar.jpg" />
              <AvatarFallback className="text-body-medium bg-primary/10 text-primary">
                {formData.first_name?.[0] || ""}{formData.last_name?.[0] || ""}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <Button variant="outline" size="sm" className="gap-2">
                <Camera className="w-4 h-4" />
                Change Picture
              </Button>
              <p className="text-caption text-muted-foreground">
                JPG, GIF or PNG. Max size 2MB.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personal Information */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-body-medium">Personal Information</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="first_name" className="text-caption">First Name</Label>
              <Input
                id="first_name"
                value={formData.first_name}
                onChange={(e) => handleChange('first_name', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="last_name" className="text-caption">Last Name</Label>
              <Input
                id="last_name"
                value={formData.last_name}
                onChange={(e) => handleChange('last_name', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="email" className="text-caption">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="job_title" className="text-caption">Job Title</Label>
              <Input
                id="job_title"
                value={formData.job_title}
                onChange={(e) => handleChange('job_title', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="phone" className="text-caption">Phone Number</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-body-medium">Preferences</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="timezone" className="text-caption">Timezone</Label>
              <Select value={formData.timezone} onValueChange={(value) => handleChange('timezone', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border-border">
                  <SelectItem value="Africa/Johannesburg">South Africa (UTC+2)</SelectItem>
                  <SelectItem value="UTC">UTC</SelectItem>
                  <SelectItem value="Europe/London">London (UTC+0)</SelectItem>
                  <SelectItem value="America/New_York">New York (UTC-5)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="language" className="text-caption">Language</Label>
              <Select value={formData.language} onValueChange={(value) => handleChange('language', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border-border">
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="af">Afrikaans</SelectItem>
                  <SelectItem value="zu">Zulu</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="date_format" className="text-caption">Date Format</Label>
            <Select value={formData.date_format} onValueChange={(value) => handleChange('date_format', value)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background border-border">
                <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={isUpdating} size="sm" className="gap-2">
              <Save className="w-4 h-4" />
              {isUpdating ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}