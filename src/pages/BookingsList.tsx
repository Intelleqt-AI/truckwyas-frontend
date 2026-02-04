import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Search, Truck, User, MapPin, Clock } from "lucide-react";
import { formatDate } from "@/lib/formatters";

// Mock data
const mockBookings = [
  {
    id: "B-901",
    quoteId: "Q-1001",
    customer: "Makana Foods",
    origin: "JHB",
    destination: "CPT",
    slaHours: 48,
    vehicle: "V-04",
    driver: "D-12",
    status: "Planned",
    invoiceStatus: "Not Raised",
    pickupDate: "2025-09-07"
  },
  {
    id: "B-902",
    quoteId: "Q-1002", 
    customer: "Tiger Brands",
    origin: "DUR",
    destination: "JHB",
    slaHours: 24,
    vehicle: "V-08",
    driver: "D-03",
    status: "En-route",
    invoiceStatus: "Raised",
    pickupDate: "2025-09-06"
  },
  {
    id: "B-903",
    quoteId: "Q-1000",
    customer: "Shoprite",
    origin: "CPT",
    destination: "JHB", 
    slaHours: 48,
    vehicle: "V-12",
    driver: "D-07",
    status: "Delivered",
    invoiceStatus: "Paid",
    pickupDate: "2025-09-03"
  }
];

export function BookingsList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBooking, setSelectedBooking] = useState<any>(null);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Planned": return { variant: "secondary" as const, color: "text-muted-foreground" };
      case "En-route": return { variant: "default" as const, color: "text-primary" };
      case "Delivered": return { variant: "default" as const, color: "text-success" };
      default: return { variant: "outline" as const, color: "text-muted-foreground" };
    }
  };

  const getInvoiceStatusBadge = (status: string) => {
    switch (status) {
      case "Not Raised": return { variant: "outline" as const, color: "text-muted-foreground" };
      case "Raised": return { variant: "secondary" as const, color: "text-warning" };
      case "Paid": return { variant: "default" as const, color: "text-success" };
      default: return { variant: "outline" as const, color: "text-muted-foreground" };
    }
  };

  const filteredBookings = mockBookings.filter(booking => 
    booking.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
    `${booking.origin} → ${booking.destination}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    booking.vehicle.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleRowClick = (booking: any) => {
    setSelectedBooking(booking);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        <h1 className="text-display-h1 font-display-bold text-brand-900">Bookings</h1>
        <p className="text-body text-muted-foreground">Track confirmed quotes and active shipments</p>
      </motion.div>

      {/* Search */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative"
      >
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by customer, lane, or vehicle..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </motion.div>

      {/* Stats Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 md:grid-cols-4 gap-4"
      >
        <Card>
          <CardContent className="p-4">
            <div className="text-display-h3 font-display-bold text-foreground text-tabular">3</div>
            <p className="text-caption text-muted-foreground">Total Bookings</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-display-h3 font-display-bold text-primary text-tabular">1</div>
            <p className="text-caption text-muted-foreground">En-route</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-display-h3 font-display-bold text-success text-tabular">1</div>
            <p className="text-caption text-muted-foreground">Delivered</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-display-h3 font-display-bold text-warning text-tabular">1</div>
            <p className="text-caption text-muted-foreground">Invoice Pending</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Bookings Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Booking ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Lane</TableHead>
                  <TableHead>SLA</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Invoice</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBookings.map((booking) => {
                  const statusBadge = getStatusBadge(booking.status);
                  const invoiceBadge = getInvoiceStatusBadge(booking.invoiceStatus);

                  return (
                    <TableRow 
                      key={booking.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleRowClick(booking)}
                    >
                      <TableCell className="font-body-medium">{booking.id}</TableCell>
                      <TableCell>{booking.customer}</TableCell>
                      <TableCell>
                        {booking.origin} → {booking.destination}
                      </TableCell>
                      <TableCell>{booking.slaHours}h</TableCell>
                      <TableCell className="font-body-medium">{booking.vehicle}</TableCell>
                      <TableCell className="font-body-medium">{booking.driver}</TableCell>
                      <TableCell>
                        <Badge variant={statusBadge.variant} className={statusBadge.color}>
                          {booking.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={invoiceBadge.variant} className={invoiceBadge.color}>
                          {booking.invoiceStatus}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            
            {filteredBookings.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No bookings found</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Booking Detail Sheet */}
      <Sheet open={!!selectedBooking} onOpenChange={() => setSelectedBooking(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{selectedBooking?.id}</SheetTitle>
            <SheetDescription>Booking details and tracking information</SheetDescription>
          </SheetHeader>
          
          {selectedBooking && (
            <div className="mt-6 space-y-6">
              {/* Customer & Lane */}
              <div className="space-y-3">
                <h4 className="text-body font-body-medium text-foreground">Shipment Details</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="text-body">{selectedBooking.customer}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span className="text-body">
                      {selectedBooking.origin} → {selectedBooking.destination}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-body">{selectedBooking.slaHours}h SLA</span>
                  </div>
                </div>
              </div>

              {/* Vehicle & Driver */}
              <div className="space-y-3">
                <h4 className="text-body font-body-medium text-foreground">Assignment</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-muted-foreground" />
                    <span className="text-body">Vehicle {selectedBooking.vehicle}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="text-body">Driver {selectedBooking.driver}</span>
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className="space-y-3">
                <h4 className="text-body font-body-medium text-foreground">Status</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-body">Shipment</span>
                    <Badge 
                      variant={getStatusBadge(selectedBooking.status).variant}
                      className={getStatusBadge(selectedBooking.status).color}
                    >
                      {selectedBooking.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-body">Invoice</span>
                    <Badge 
                      variant={getInvoiceStatusBadge(selectedBooking.invoiceStatus).variant}
                      className={getInvoiceStatusBadge(selectedBooking.invoiceStatus).color}
                    >
                      {selectedBooking.invoiceStatus}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-3">
                <h4 className="text-body font-body-medium text-foreground">Actions</h4>
                <div className="space-y-2">
                  <Button variant="outline" className="w-full justify-start">
                    View in Finance HQ
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    Track Shipment
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    Generate Invoice
                  </Button>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}