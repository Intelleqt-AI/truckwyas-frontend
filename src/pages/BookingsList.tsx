import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { fetchData } from "@/lib/Api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Search, Truck, User, MapPin, Clock } from "lucide-react";
import { formatDate } from "@/lib/formatters";



export function BookingsList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');

  useEffect(() => {
    fetchData('api/v1/loads/?limit=100').then(d => {
      const raw = d?.results || d || [];
      setBookings(raw.map((l: any) => ({
        id: l.load_number || `L-${l.id}`,
        quoteId: l.quote || '—',
        customer: l.customer_name || l.customer || '—',
        origin: l.pickup_location || '—',
        destination: l.delivery_location || '—',
        slaHours: l.sla_hours || 48,
        vehicle: l.vehicle || '—',
        driver: l.driver || '—',
        status: l.status === 'IN_TRANSIT' ? 'En-route' : l.status === 'DELIVERED' ? 'Delivered' : l.status === 'LOADING' ? 'Loading' : 'Planned',
        invoiceStatus: l.invoices?.length > 0 ? 'Raised' : 'Not Raised',
        pickupDate: l.pickup_date || l.created_at?.split('T')[0] || '',
      })));
    }).catch(() => setBookings([])).finally(() => setLoadingData(false));
  }, []);

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

  const filteredBookings = bookings.filter(booking => {
    const matchesSearch = booking.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${booking.origin} → ${booking.destination}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.vehicle.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || booking.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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

      {/* Status Filter Buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        {['All', 'En-route', 'Delivered', 'Loading', 'Planned'].map(status => {
          const isActive = statusFilter === status;
          return (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              style={{
                background: isActive ? 'var(--accent-primary)' : 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                color: isActive ? 'var(--bg-deep)' : 'var(--text-secondary)',
                padding: '6px 12px',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                borderRadius: 2,
                cursor: 'pointer',
                textTransform: 'uppercase' as const,
                letterSpacing: '0.06em',
                fontWeight: isActive ? 600 : 400,
                transition: 'all 0.2s ease'
              }}
            >
              {status === 'All' ? 'ALL' : status.toUpperCase()}
            </button>
          );
        })}
      </div>

      {/* Stats Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 md:grid-cols-4 gap-4"
      >
        <Card>
          <CardContent className="p-5">
            <div className="text-display-h3 font-display-bold text-foreground text-tabular">{loadingData ? '...' : bookings.length}</div>
            <p className="text-caption text-muted-foreground">Total Bookings</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-display-h3 font-display-bold text-primary text-tabular">{loadingData ? '...' : bookings.filter(b => b.status === 'En-route').length}</div>
            <p className="text-caption text-muted-foreground">En-route</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-display-h3 font-display-bold text-success text-tabular">{loadingData ? '...' : bookings.filter(b => b.status === 'Delivered').length}</div>
            <p className="text-caption text-muted-foreground">Delivered</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-display-h3 font-display-bold text-warning text-tabular">{loadingData ? '...' : bookings.filter(b => b.invoiceStatus === 'Not Raised').length}</div>
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
              <div className="text-center p-10">
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