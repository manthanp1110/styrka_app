import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  SafeAreaView,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { TrackingDataService, User, AssignedDestination } from '../services/TrackingDataService';
import SocketService from '../services/SocketService';

export const AdminJourneyLogsScreen = ({ navigation }: any) => {
  const [employees, setEmployees] = useState<User[]>([]);
  const [allDestinations, setAllDestinations] = useState<AssignedDestination[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Date Filtering State
  const [selectedDate, setSelectedDate] = useState<string | null>(null); // YYYY-MM-DD
  const [isCalendarOpen, setIsCalendarOpen] = useState<boolean>(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());

  const loadData = async () => {
    try {
      const [empList, destList] = await Promise.all([
        TrackingDataService.getEmployees(),
        TrackingDataService.getAllDestinations(),
      ]);
      setEmployees(empList || []);
      setAllDestinations(destList || []);
    } catch (e) {
      console.error('[AdminJourneyLogsScreen] Load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();

    // Listen to real-time destination assignments & journey status completion events
    const handleDestAssigned = (data: any) => {
      console.log('[AdminJourneyLogsScreen] Socket destination received:', data);
      loadData();
    };

    const handleStatusChanged = (data: any) => {
      console.log('[AdminJourneyLogsScreen] Socket status changed:', data);
      loadData();
    };

    SocketService.on('destination_assigned', handleDestAssigned);
    SocketService.on('journey_status_changed', handleStatusChanged);

    const unsubscribe = navigation?.addListener?.('focus', () => {
      loadData();
    });

    return () => {
      SocketService.off('destination_assigned', handleDestAssigned);
      SocketService.off('journey_status_changed', handleStatusChanged);
      unsubscribe?.();
    };
  }, [navigation]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Filter employees by search query
  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return employees;
    const q = searchQuery.toLowerCase();
    return employees.filter(
      (e) =>
        (e.name || '').toLowerCase().includes(q) ||
        (e.email || '').toLowerCase().includes(q)
    );
  }, [employees, searchQuery]);

  // Get destinations for selected employee
  const employeeDestinations = useMemo(() => {
    if (!selectedEmployee) return [];
    const empId = (selectedEmployee.id || '').toLowerCase();
    const empEmail = (selectedEmployee.email || '').toLowerCase();
    const empName = (selectedEmployee.name || '').toLowerCase();

    const matched = allDestinations.filter((d) => {
      const target = (d.employee_id || '').toLowerCase();
      if (!target) return true;
      return (
        target === empId ||
        (empEmail && target === empEmail) ||
        (empEmail && target.includes(empEmail)) ||
        (empEmail && empEmail.includes(target)) ||
        (empId && target.includes(empId)) ||
        (empName && target.includes(empName)) ||
        (empName && empName.includes(target))
      );
    });

    if (matched.length > 0) return matched;

    // Fallback: If no strict ID match, return all destinations so Admin always sees active logs
    return allDestinations;
  }, [selectedEmployee, allDestinations]);

  // Extract list of dates that have journey records for calendar markers
  const activeDatesSet = useMemo(() => {
    const set = new Set<string>();
    employeeDestinations.forEach((d) => {
      const createdIso = d.created_at ? new Date(d.created_at).toISOString().split('T')[0] : null;
      const completedIso = d.completed_at ? new Date(d.completed_at).toISOString().split('T')[0] : null;
      if (createdIso) set.add(createdIso);
      if (completedIso) set.add(completedIso);
    });
    return set;
  }, [employeeDestinations]);

  // Filter employee destinations by selected date
  const filteredDestinations = useMemo(() => {
    if (!selectedDate) return employeeDestinations;
    return employeeDestinations.filter((d) => {
      const createdIso = d.created_at ? new Date(d.created_at).toISOString().split('T')[0] : null;
      const completedIso = d.completed_at ? new Date(d.completed_at).toISOString().split('T')[0] : null;
      return createdIso === selectedDate || completedIso === selectedDate;
    });
  }, [employeeDestinations, selectedDate]);

  // Format Helper: ISO date to formatted string
  const formatDateTime = (isoString?: string) => {
    if (!isoString) return { dateStr: 'N/A', timeStr: 'N/A' };
    const dt = new Date(isoString);
    const dateStr = dt.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = dt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true });
    return { dateStr, timeStr };
  };

  // Helper: Calculate duration between start and completion
  const calculateDuration = (startIso?: string, endIso?: string) => {
    if (!startIso || !endIso) return null;
    const startMs = new Date(startIso).getTime();
    const endMs = new Date(endIso).getTime();
    if (isNaN(startMs) || isNaN(endMs) || endMs < startMs) return null;

    const diffMin = Math.floor((endMs - startMs) / (1000 * 60));
    const hours = Math.floor(diffMin / 60);
    const minutes = diffMin % 60;
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes} min`;
  };

  // Calendar Grid Generator
  const generateCalendarDays = () => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: ({ day: number; dateIso: string; hasRecords: boolean } | null)[] = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const monthStr = String(month + 1).padStart(2, '0');
      const dayStr = String(d).padStart(2, '0');
      const dateIso = `${year}-${monthStr}-${dayStr}`;
      days.push({
        day: d,
        dateIso,
        hasRecords: activeDatesSet.has(dateIso),
      });
    }

    return days;
  };

  const todayIso = new Date().toISOString().split('T')[0];
  const yesterdayObj = new Date();
  yesterdayObj.setDate(yesterdayObj.getDate() - 1);
  const yesterdayIso = yesterdayObj.toISOString().split('T')[0];

  return (
    <SafeAreaView style={styles.container}>
      {/* Top App Header */}
      <View style={styles.header}>
        {selectedEmployee ? (
          <TouchableOpacity onPress={() => setSelectedEmployee(null)} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color="white" />
          </TouchableOpacity>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>
            {selectedEmployee ? selectedEmployee.name : 'Journey Logs'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {selectedEmployee ? selectedEmployee.email : 'Select employee to view journey history'}
          </Text>
        </View>
        <TouchableOpacity onPress={handleRefresh} style={styles.refreshHeaderBtn}>
          <Feather name="refresh-cw" size={18} color="white" />
        </TouchableOpacity>
      </View>

      {/* Main Content Area */}
      {!selectedEmployee ? (
        /* STEP 1: EMPLOYEE LIST VIEW */
        <View style={{ flex: 1, padding: 16 }}>
          {/* Search Bar */}
          <View style={styles.searchBox}>
            <Feather name="search" size={20} color="#9CA3AF" style={{ marginRight: 10 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search employee by name or email..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Feather name="x-circle" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.sectionHeading}>
            Select Employee ({filteredEmployees.length})
          </Text>

          {loading ? (
            <ActivityIndicator size="large" color="#0F4C3A" style={{ marginTop: 30 }} />
          ) : (
            <FlatList
              data={filteredEmployees}
              keyExtractor={(item, index) => item.id ? `${item.id}_${index}` : `emp_${index}`}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#0F4C3A']} />}
              renderItem={({ item }) => {
                const empDests = allDestinations.filter((d) => {
                  const target = (d.employee_id || '').toLowerCase();
                  return (
                    target === item.id.toLowerCase() ||
                    (item.email && target === item.email.toLowerCase())
                  );
                });
                const completedCount = empDests.filter((d) => d.status === 'completed').length;

                return (
                  <TouchableOpacity
                    style={styles.empCard}
                    onPress={() => {
                      setSelectedEmployee(item);
                      setSelectedDate(null);
                    }}
                  >
                    <View style={styles.avatarCircle}>
                      <Text style={styles.avatarText}>{item.name?.charAt(0).toUpperCase() || 'E'}</Text>
                    </View>

                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.empName}>{item.name}</Text>
                      <Text style={styles.empEmail}>{item.email}</Text>
                    </View>

                    <View style={styles.countBadge}>
                      <Text style={styles.countText}>{completedCount} Completed</Text>
                      <Text style={styles.totalText}>{empDests.length} Total</Text>
                    </View>

                    <Feather name="chevron-right" size={20} color="#9CA3AF" style={{ marginLeft: 8 }} />
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyCard}>
                  <Feather name="users" size={36} color="#9CA3AF" />
                  <Text style={styles.emptyText}>No employees found</Text>
                </View>
              }
            />
          )}
        </View>
      ) : (
        /* STEP 2: SELECTED EMPLOYEE JOURNEY LOGS VIEW */
        <View style={{ flex: 1, padding: 16 }}>
          {/* Quick Date Selector Toolbar */}
          <View style={styles.dateSelectorRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center' }}>
              <TouchableOpacity
                style={[styles.dateChip, selectedDate === null && styles.dateChipActive]}
                onPress={() => setSelectedDate(null)}
              >
                <Text style={[styles.dateChipText, selectedDate === null && styles.dateChipTextActive]}>
                  All Logs ({employeeDestinations.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.dateChip, selectedDate === todayIso && styles.dateChipActive]}
                onPress={() => setSelectedDate(todayIso)}
              >
                <Text style={[styles.dateChipText, selectedDate === todayIso && styles.dateChipTextActive]}>
                  Today
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.dateChip, selectedDate === yesterdayIso && styles.dateChipActive]}
                onPress={() => setSelectedDate(yesterdayIso)}
              >
                <Text style={[styles.dateChipText, selectedDate === yesterdayIso && styles.dateChipTextActive]}>
                  Yesterday
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.calendarBtn, selectedDate !== null && selectedDate !== todayIso && selectedDate !== yesterdayIso && styles.calendarBtnActive]}
                onPress={() => setIsCalendarOpen(true)}
              >
                <Feather name="calendar" size={16} color={selectedDate ? '#FFFFFF' : '#0F4C3A'} style={{ marginRight: 6 }} />
                <Text style={[styles.calendarBtnText, selectedDate ? { color: '#FFFFFF' } : {}]}>
                  {selectedDate ? selectedDate : 'Calendar Filter'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Active Date Filter Notice */}
          {selectedDate ? (
            <View style={styles.filterNoticeBar}>
              <Text style={styles.filterNoticeText}>
                Showing logs for: <Text style={{ fontWeight: 'bold' }}>{selectedDate}</Text>
              </Text>
              <TouchableOpacity onPress={() => setSelectedDate(null)}>
                <Text style={styles.clearFilterText}>Clear Date</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Journey Logs List */}
          <FlatList
            data={filteredDestinations}
            keyExtractor={(item) => item.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#0F4C3A']} />}
            renderItem={({ item }) => {
              const isCompleted = item.status === 'completed';
              const isInProgress = item.status === 'in_progress';

              const startInfo = formatDateTime(item.created_at);
              const endInfo = isCompleted ? formatDateTime(item.completed_at || item.updated_at) : null;
              const durationStr = isCompleted ? calculateDuration(item.created_at, item.completed_at || item.updated_at) : null;

              return (
                <View style={styles.journeyCard}>
                  {/* Card Header & Status Badge */}
                  <View style={styles.journeyCardHeader}>
                    <View style={[
                      styles.logBadge,
                      isCompleted ? styles.logCompleted : (isInProgress ? styles.logInProgress : styles.logPending)
                    ]}>
                      <Feather
                        name={isCompleted ? 'check-circle' : (isInProgress ? 'navigation' : 'clock')}
                        size={13}
                        color={isCompleted ? '#059669' : (isInProgress ? '#10B981' : '#D97706')}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={[
                        styles.logBadgeText,
                        isCompleted ? styles.textCompleted : (isInProgress ? styles.textInProgress : styles.textPending)
                      ]}>
                        {isCompleted ? 'JOURNEY COMPLETED' : (isInProgress ? 'IN PROGRESS' : 'ASSIGNED / READY')}
                      </Text>
                    </View>

                    {durationStr ? (
                      <View style={styles.durationChip}>
                        <Feather name="clock" size={12} color="#4B5563" style={{ marginRight: 4 }} />
                        <Text style={styles.durationChipText}>{durationStr}</Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Destination Address */}
                  <View style={styles.destAddressRow}>
                    <Feather name="map-pin" size={20} color={isCompleted ? '#059669' : '#F59E0B'} style={{ marginTop: 2, marginRight: 8 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.destLabel}>DESTINATION LOCATION</Text>
                      <Text style={styles.destAddressText}>{item.address || 'Custom Destination'}</Text>
                    </View>
                  </View>

                  {/* Timings Details Row */}
                  <View style={styles.timingSection}>
                    <View style={styles.timingBox}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Feather name="play" size={14} color="#10B981" style={{ marginRight: 4 }} />
                        <Text style={styles.timingBoxLabel}>STARTED</Text>
                      </View>
                      <Text style={styles.timingDate}>{startInfo.dateStr}</Text>
                      <Text style={styles.timingTime}>{startInfo.timeStr}</Text>
                    </View>

                    <View style={styles.timingDivider} />

                    <View style={styles.timingBox}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Feather name="flag" size={14} color={isCompleted ? '#3B82F6' : '#9CA3AF'} style={{ marginRight: 4 }} />
                        <Text style={styles.timingBoxLabel}>COMPLETED</Text>
                      </View>
                      {isCompleted && endInfo ? (
                        <>
                          <Text style={styles.timingDate}>{endInfo.dateStr}</Text>
                          <Text style={styles.timingTime}>{endInfo.timeStr}</Text>
                        </>
                      ) : (
                        <>
                          <Text style={[styles.timingDate, { color: '#9CA3AF' }]}>--</Text>
                          <Text style={[styles.timingTime, { color: '#9CA3AF' }]}>{isInProgress ? 'In Progress' : 'Pending'}</Text>
                        </>
                      )}
                    </View>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyCard}>
                <Feather name="calendar" size={36} color="#9CA3AF" />
                <Text style={styles.emptyText}>No journey logs for this date</Text>
                <Text style={{ color: '#6B7280', fontSize: 13, marginTop: 4, textAlign: 'center' }}>
                  Select another date or clear the filter to view all employee logs.
                </Text>
              </View>
            }
          />
        </View>
      )}

      {/* CALENDAR DATE PICKER MODAL */}
      <Modal visible={isCalendarOpen} transparent animationType="fade" onRequestClose={() => setIsCalendarOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.calendarContainer}>
            {/* Calendar Header / Month Controls */}
            <View style={styles.calendarHeader}>
              <TouchableOpacity
                onPress={() => {
                  const prevMonth = new Date(calendarMonth);
                  prevMonth.setMonth(prevMonth.getMonth() - 1);
                  setCalendarMonth(prevMonth);
                }}
                style={styles.monthNavBtn}
              >
                <Feather name="chevron-left" size={20} color="#1F2937" />
              </TouchableOpacity>

              <Text style={styles.monthTitle}>
                {calendarMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              </Text>

              <TouchableOpacity
                onPress={() => {
                  const nextMonth = new Date(calendarMonth);
                  nextMonth.setMonth(nextMonth.getMonth() + 1);
                  setCalendarMonth(nextMonth);
                }}
                style={styles.monthNavBtn}
              >
                <Feather name="chevron-right" size={20} color="#1F2937" />
              </TouchableOpacity>
            </View>

            {/* Days of Week Row */}
            <View style={styles.daysHeaderRow}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
                <Text key={i} style={styles.dayHeaderCell}>{d}</Text>
              ))}
            </View>

            {/* Calendar Grid */}
            <View style={styles.gridContainer}>
              {generateCalendarDays().map((cell, idx) => {
                if (!cell) {
                  return <View key={idx} style={styles.gridCellEmpty} />;
                }
                const isSelected = selectedDate === cell.dateIso;
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.gridCell,
                      isSelected && styles.gridCellSelected,
                      cell.hasRecords && !isSelected && styles.gridCellHasRecords,
                    ]}
                    onPress={() => {
                      setSelectedDate(cell.dateIso);
                      setIsCalendarOpen(false);
                    }}
                  >
                    <Text style={[styles.gridCellText, isSelected && styles.gridCellTextSelected]}>
                      {cell.day}
                    </Text>
                    {cell.hasRecords ? (
                      <View style={[styles.dotIndicator, isSelected && { backgroundColor: 'white' }]} />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Modal Actions */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.clearModalBtn}
                onPress={() => {
                  setSelectedDate(null);
                  setIsCalendarOpen(false);
                }}
              >
                <Text style={styles.clearModalBtnText}>Show All Dates</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.closeModalBtn}
                onPress={() => setIsCalendarOpen(false)}
              >
                <Text style={styles.closeModalBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default AdminJourneyLogsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    backgroundColor: '#0F4C3A',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: {
    padding: 6,
    marginRight: 8,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 18,
  },
  headerSubtitle: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  refreshHeaderBtn: {
    padding: 8,
  },
  searchBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 12,
  },
  empCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0F4C3A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 18,
  },
  empName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  empEmail: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  countBadge: {
    alignItems: 'flex-end',
  },
  countText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#059669',
  },
  totalText: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#374151',
    marginTop: 10,
  },

  // Date Selector Toolbar
  dateSelectorRow: {
    marginBottom: 12,
  },
  dateChip: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dateChipActive: {
    backgroundColor: '#0F4C3A',
    borderColor: '#0F4C3A',
  },
  dateChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  dateChipTextActive: {
    color: '#FFFFFF',
  },
  calendarBtn: {
    backgroundColor: '#ECFDF5',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  calendarBtnActive: {
    backgroundColor: '#0F4C3A',
    borderColor: '#0F4C3A',
  },
  calendarBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0F4C3A',
  },
  filterNoticeBar: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  filterNoticeText: {
    fontSize: 13,
    color: '#92400E',
  },
  clearFilterText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#B45309',
  },

  // Journey Log Card
  journeyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  journeyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  logBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  logCompleted: { backgroundColor: '#D1FAE5' },
  logInProgress: { backgroundColor: '#ECFDF5' },
  logPending: { backgroundColor: '#FEF3C7' },
  logBadgeText: { fontSize: 11, fontWeight: 'bold' },
  textCompleted: { color: '#059669' },
  textInProgress: { color: '#10B981' },
  textPending: { color: '#D97706' },
  durationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  durationChipText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#374151',
  },
  destAddressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  destLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#9CA3AF',
    letterSpacing: 0.5,
  },
  destAddressText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 2,
  },
  timingSection: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  timingBox: {
    flex: 1,
  },
  timingBoxLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#6B7280',
    letterSpacing: 0.5,
  },
  timingDate: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 4,
  },
  timingTime: {
    fontSize: 12,
    color: '#4B5563',
    marginTop: 2,
  },
  timingDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 12,
  },

  // Calendar Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  calendarContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    width: '100%',
    maxWidth: 360,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  monthNavBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  daysHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  dayHeaderCell: {
    width: 38,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: 'bold',
    color: '#9CA3AF',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridCellEmpty: {
    width: '14.28%',
    height: 40,
  },
  gridCell: {
    width: '14.28%',
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    marginVertical: 2,
  },
  gridCellSelected: {
    backgroundColor: '#0F4C3A',
  },
  gridCellHasRecords: {
    backgroundColor: '#ECFDF5',
  },
  gridCellText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  gridCellTextSelected: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  dotIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#059669',
    marginTop: 2,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  clearModalBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  clearModalBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#4B5563',
  },
  closeModalBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#0F4C3A',
  },
  closeModalBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});
