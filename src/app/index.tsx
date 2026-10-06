import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

type Schedule = 'daily' | 'weekdays' | 'weekends';

type Habit = {
  id: string;
  name: string;
  target: string;
  icon: string;
  schedule: Schedule;
  reminder?: string;
  createdAt: string;
  completions: Record<string, boolean>;
  notificationIds?: string[];
};

type Todo = {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
};

const HABITS_KEY = 'habitflow-mobile-habits-v2';
const TODOS_KEY = 'habitflow-mobile-todos-v1';

const STARTER_HABITS: Habit[] = [
  {
    id: 'water',
    name: 'Drink Water',
    target: '8 glasses',
    icon: '💧',
    schedule: 'daily',
    reminder: '09:00',
    createdAt: new Date().toISOString(),
    completions: {},
  },
  {
    id: 'dsa',
    name: 'DSA Practice',
    target: '45 minutes',
    icon: '🧠',
    schedule: 'weekdays',
    reminder: '18:00',
    createdAt: new Date().toISOString(),
    completions: {},
  },
  {
    id: 'read',
    name: 'Read',
    target: '20 minutes',
    icon: '📖',
    schedule: 'daily',
    reminder: '21:00',
    createdAt: new Date().toISOString(),
    completions: {},
  },
  {
    id: 'exercise',
    name: 'Exercise',
    target: '30 minutes',
    icon: '🏃',
    schedule: 'weekdays',
    reminder: '07:00',
    createdAt: new Date().toISOString(),
    completions: {},
  },
];

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function getDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function isScheduledToday(schedule: Schedule) {
  const day = new Date().getDay();

  if (schedule === 'daily') return true;

  if (schedule === 'weekdays') {
    return day >= 1 && day <= 5;
  }

  return day === 0 || day === 6;
}

function getPreviousDate(date: Date) {
  const previous = new Date(date);
  previous.setDate(previous.getDate() - 1);
  return previous;
}

function calculateStreak(habit: Habit) {
  let streak = 0;
  let current = new Date();

  if (!habit.completions[getDateKey(current)]) {
    current = getPreviousDate(current);
  }

  while (habit.completions[getDateKey(current)]) {
    streak++;
    current = getPreviousDate(current);
  }

  return streak;
}

function getWeekdayName() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
  });
}

function getFormattedDate() {
  return new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function getNextReminderDate(time: string) {
  const [hours, minutes] = time.split(':').map(Number);

  const now = new Date();

  const reminder = new Date();
  reminder.setHours(hours);
  reminder.setMinutes(minutes);
  reminder.setSeconds(0);
  reminder.setMilliseconds(0);

  if (reminder <= now) {
    reminder.setDate(reminder.getDate() + 1);
  }

  return reminder;
}

async function requestNotificationPermission() {
  if (Platform.OS === 'web') return false;

  try {
    const existing = await Notifications.getPermissionsAsync();

    if (existing.status === 'granted') {
      return true;
    }

    const result = await Notifications.requestPermissionsAsync();

    return result.status === 'granted';
  } catch (error) {
    console.log('Notification permission failed:', error);
    return false;
  }
}

async function setupNotificationChannel() {
  if (Platform.OS !== 'android') return;

  try {
    await Notifications.setNotificationChannelAsync(
      'habit-reminders',
      {
        name: 'Habit reminders',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
      }
    );
  } catch (error) {
    console.log('Notification channel setup failed:', error);
  }
}

function getReminderTime(reminder: string) {
  const [hour, minute] = reminder.split(':').map(Number);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return { hour, minute };
}

async function scheduleHabitNotifications(habit: Habit) {
  if (!habit.reminder || Platform.OS === 'web') {
    return [];
  }

  const allowed = await requestNotificationPermission();

  if (!allowed) {
    return [];
  }

  await setupNotificationChannel();

  const time = getReminderTime(habit.reminder);

  if (!time) {
    Alert.alert(
      'Invalid reminder',
      'Please enter the reminder time as HH:MM, for example 18:30.'
    );
    return [];
  }

  try {
    const notificationIds: string[] = [];
    const content = {
      title: `HabitFlow • ${habit.name}`,
      body: `Time to complete your habit: ${habit.target}`,
      sound: 'default' as const,
      ...(Platform.OS === 'android'
        ? { channelId: 'habit-reminders' }
        : {}),
    };

    if (habit.schedule === 'daily') {
      const id = await Notifications.scheduleNotificationAsync({
        content,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: time.hour,
          minute: time.minute,
        },
      });

      notificationIds.push(id);
    }

    if (habit.schedule === 'weekdays') {
      for (const weekday of [2, 3, 4, 5, 6]) {
        const id = await Notifications.scheduleNotificationAsync({
          content,
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday,
            hour: time.hour,
            minute: time.minute,
          },
        });

        notificationIds.push(id);
      }
    }

    if (habit.schedule === 'weekends') {
      for (const weekday of [1, 7]) {
        const id = await Notifications.scheduleNotificationAsync({
          content,
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday,
            hour: time.hour,
            minute: time.minute,
          },
        });

        notificationIds.push(id);
      }
    }

    return notificationIds;
  } catch (error) {
    console.log('Notification scheduling failed:', error);
    return [];
  }
}

async function cancelHabitNotifications(notificationIds?: string[]) {
  if (!notificationIds?.length || Platform.OS === 'web') return;

  for (const notificationId of notificationIds) {
    try {
      await Notifications.cancelScheduledNotificationAsync(
        notificationId
      );
    } catch (error) {
      console.log('Notification cancellation failed:', error);
    }
  }
}

export default function HomeScreen() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [activeTab, setActiveTab] = useState<
    'today' | 'history' | 'insights'
  >('today');

  const [showAddModal, setShowAddModal] = useState(false);
  const [newTodo, setNewTodo] = useState('');

  const [newName, setNewName] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [newIcon, setNewIcon] = useState('⭐');
  const [newReminder, setNewReminder] = useState('');
  const [showTimePicker, setShowTimePicker] =
    useState(false);
  const [reminderTime, setReminderTime] = useState(() => {
    const date = new Date();
    date.setHours(9, 0, 0, 0);
    return date;
  });
  const [newSchedule, setNewSchedule] =
    useState<Schedule>('daily');

  const todayKey = getDateKey();

  useEffect(() => {
    loadHabits();
  }, []);

  useEffect(() => {
    const setupNotifications = async () => {
      await setupNotificationChannel();
      await requestNotificationPermission();
    };

    setupNotifications();
  }, []);

  useEffect(() => {
    if (!loaded || Platform.OS === 'web') return;

    const setupExistingNotifications = async () => {
      const allowed = await requestNotificationPermission();

      if (!allowed) return;

      const updatedHabits = [...habits];
      let changed = false;

      for (let i = 0; i < updatedHabits.length; i++) {
        const habit = updatedHabits[i];

        if (
          habit.reminder &&
          (!habit.notificationIds ||
            habit.notificationIds.length === 0)
        ) {
          const notificationIds =
            await scheduleHabitNotifications(habit);

          updatedHabits[i] = {
            ...habit,
            notificationIds,
          };

          changed = true;
        }
      }

      if (changed) {
        setHabits(updatedHabits);
      }
    };

    setupExistingNotifications();
  }, [loaded, habits]);

  useEffect(() => {
    if (!loaded) return;

    AsyncStorage.setItem(
      HABITS_KEY,
      JSON.stringify(habits)
    ).catch((error) => {
      console.log('Failed to save habits:', error);
    });

    AsyncStorage.setItem(
      TODOS_KEY,
      JSON.stringify(todos)
    ).catch((error) => {
      console.log('Failed to save to-dos:', error);
    });
  }, [habits, todos, loaded]);

  async function loadHabits() {
    try {
      const [savedHabits, savedTodos] = await Promise.all([
        AsyncStorage.getItem(HABITS_KEY),
        AsyncStorage.getItem(TODOS_KEY),
      ]);

      if (savedHabits) {
        setHabits(JSON.parse(savedHabits));
      } else {
        setHabits(STARTER_HABITS);
      }

      if (savedTodos) {
        setTodos(JSON.parse(savedTodos));
      }
    } catch (error) {
      console.log('Failed to load habits:', error);
      setHabits(STARTER_HABITS);
    } finally {
      setLoaded(true);
    }
  }

  const todaysHabits = useMemo(
    () =>
      habits.filter((habit) =>
        isScheduledToday(habit.schedule)
      ),
    [habits]
  );

  const completedToday = todaysHabits.filter(
    (habit) => habit.completions[todayKey]
  ).length;

  const progress =
    todaysHabits.length === 0
      ? 0
      : completedToday / todaysHabits.length;

  const totalCompleted = habits.reduce(
    (total, habit) =>
      total +
      Object.values(habit.completions).filter(Boolean).length,
    0
  );

  const bestStreak = Math.max(
    0,
    ...habits.map(calculateStreak)
  );

  function toggleHabit(id: string) {
    setHabits((current) =>
      current.map((habit) => {
        if (habit.id !== id) return habit;

        const completions = {
          ...habit.completions,
          [todayKey]: !habit.completions[todayKey],
        };

        return {
          ...habit,
          completions,
        };
      })
    );
  }

  function addTodo() {
    const title = newTodo.trim();

    if (!title) {
      Alert.alert('To-do required', 'Please enter a task first.');
      return;
    }

    setTodos((current) => [
      ...current,
      {
        id: Date.now().toString(),
        title,
        completed: false,
        createdAt: new Date().toISOString(),
      },
    ]);
    setNewTodo('');
  }

  function toggleTodo(id: string) {
    setTodos((current) =>
      current.map((todo) =>
        todo.id === id
          ? { ...todo, completed: !todo.completed }
          : todo
      )
    );
  }

  function deleteTodo(id: string) {
    setTodos((current) =>
      current.filter((todo) => todo.id !== id)
    );
  }

  async function addHabit() {
    if (!newName.trim()) {
      Alert.alert('Habit name required', 'Please enter a habit name.');
      return;
    }

    const habit: Habit = {
      id: Date.now().toString(),
      name: newName.trim(),
      target: newTarget.trim() || 'Complete habit',
      icon: newIcon || '⭐',
      schedule: newSchedule,
      reminder: newReminder.trim() || undefined,
      createdAt: new Date().toISOString(),
      completions: {},
    };

    if (habit.reminder) {
      habit.notificationIds =
        await scheduleHabitNotifications(habit);
    }

    setHabits((current) => [...current, habit]);

    setNewName('');
    setNewTarget('');
    setNewIcon('⭐');
    setNewReminder('');
    setShowTimePicker(false);
    const defaultTime = new Date();
    defaultTime.setHours(9, 0, 0, 0);
    setReminderTime(defaultTime);
    setNewSchedule('daily');
    setShowAddModal(false);
  }

  function deleteHabit(habit: Habit) {
    Alert.alert(
      'Delete habit?',
      `Delete "${habit.name}"? Its history will also be removed.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await cancelHabitNotifications(
              habit.notificationIds
            );

            setHabits((current) =>
              current.filter((item) => item.id !== habit.id)
            );
          },
        },
      ]
    );
  }

  function getLastSevenDays() {
    const days = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);

      days.push({
        date,
        key: getDateKey(date),
        label: date.toLocaleDateString('en-US', {
          weekday: 'short',
        }),
      });
    }

    return days;
  }

  if (!loaded) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ThemedText type="title">HabitFlow</ThemedText>
        <ThemedText style={styles.muted}>
          Loading your habits...
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          {/* HEADER */}
          <ThemedView style={styles.header}>
            <ThemedText style={styles.greeting}>
              Good morning
            </ThemedText>

            <ThemedText type="title" style={styles.title}>
              HabitFlow
            </ThemedText>

            <ThemedText style={styles.date}>
              {getWeekdayName()}, {getFormattedDate()}
            </ThemedText>
          </ThemedView>

          {/* TAB NAVIGATION */}
          <ThemedView style={styles.tabs}>
            <Pressable
              onPress={() => setActiveTab('today')}
              style={[
                styles.tab,
                activeTab === 'today' && styles.activeTab,
              ]}
            >
              <ThemedText>Today</ThemedText>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab('history')}
              style={[
                styles.tab,
                activeTab === 'history' && styles.activeTab,
              ]}
            >
              <ThemedText>History</ThemedText>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab('insights')}
              style={[
                styles.tab,
                activeTab === 'insights' && styles.activeTab,
              ]}
            >
              <ThemedText>Insights</ThemedText>
            </Pressable>
          </ThemedView>

          {/* TODAY */}
          {activeTab === 'today' && (
            <>
              <ThemedView style={styles.progressCard}>
                <ThemedView style={styles.progressCircle}>
                  <ThemedText style={styles.progressNumber}>
                    {completedToday}/{todaysHabits.length}
                  </ThemedText>

                  <ThemedText style={styles.progressLabel}>
                    completed
                  </ThemedText>
                </ThemedView>

                <ThemedView style={styles.progressInfo}>
                  <ThemedText type="subtitle">
                    Daily Progress
                  </ThemedText>

                  <ThemedText style={styles.progressDescription}>
                    {progress === 1
                      ? 'Amazing! All habits completed.'
                      : `${Math.round(
                          progress * 100
                        )}% complete today.`}
                  </ThemedText>
                </ThemedView>
              </ThemedView>

              <ThemedView style={styles.sectionHeader}>
                <ThemedText type="subtitle">
                  Today's habits
                </ThemedText>

                <Pressable
                  onPress={() => setShowAddModal(true)}
                  style={styles.addButton}
                >
                  <ThemedText style={styles.addButtonText}>
                    + Add
                  </ThemedText>
                </Pressable>
              </ThemedView>

              <ThemedView style={styles.habitList}>
                {todaysHabits.length === 0 ? (
                  <ThemedView style={styles.emptyCard}>
                    <ThemedText type="subtitle">
                      No habits scheduled today
                    </ThemedText>

                    <ThemedText style={styles.muted}>
                      Add a habit to get started.
                    </ThemedText>
                  </ThemedView>
                ) : (
                  todaysHabits.map((habit) => {
                    const completed =
                      !!habit.completions[todayKey];

                    return (
                      <Pressable
                        key={habit.id}
                        onPress={() =>
                          toggleHabit(habit.id)
                        }
                        onLongPress={() =>
                          deleteHabit(habit)
                        }
                        style={[
                          styles.habitCard,
                          completed &&
                            styles.completedCard,
                        ]}
                      >
                        <ThemedView
                          style={styles.iconContainer}
                        >
                          <ThemedText style={styles.icon}>
                            {habit.icon}
                          </ThemedText>
                        </ThemedView>

                        <ThemedView
                          style={styles.habitInfo}
                        >
                          <ThemedText type="smallBold">
                            {habit.name}
                          </ThemedText>

                          <ThemedText
                            style={styles.target}
                          >
                            {habit.target}
                            {habit.reminder
                              ? ` • ${habit.reminder}`
                              : ''}
                          </ThemedText>
                        </ThemedView>

                        <ThemedView
                          style={[
                            styles.check,
                            completed &&
                              styles.checked,
                          ]}
                        >
                          <ThemedText
                            style={styles.checkText}
                          >
                            {completed ? '✓' : ''}
                          </ThemedText>
                        </ThemedView>
                      </Pressable>
                    );
                  })
                )}
              </ThemedView>

              <ThemedView style={styles.todoSection}>
                <ThemedView style={styles.sectionHeader}>
                  <ThemedText type="subtitle">To-do list</ThemedText>
                  <ThemedText style={styles.count}>
                    {todos.filter((todo) => todo.completed).length}/
                    {todos.length}
                  </ThemedText>
                </ThemedView>

                <View style={styles.todoInputRow}>
                  <TextInput
                    value={newTodo}
                    onChangeText={setNewTodo}
                    onSubmitEditing={addTodo}
                    placeholder="Add a task"
                    placeholderTextColor="#888"
                    style={styles.todoInput}
                    returnKeyType="done"
                  />
                  <Pressable
                    onPress={addTodo}
                    style={styles.todoAddButton}
                  >
                    <ThemedText style={styles.addButtonText}>
                      Add
                    </ThemedText>
                  </Pressable>
                </View>

                {todos.length === 0 ? (
                  <ThemedText style={styles.muted}>
                    No tasks yet. Add one to stay organized.
                  </ThemedText>
                ) : (
                  <ThemedView style={styles.todoList}>
                    {todos.map((todo) => (
                      <View key={todo.id} style={styles.todoRow}>
                        <Pressable
                          onPress={() => toggleTodo(todo.id)}
                          style={[
                            styles.todoCheck,
                            todo.completed && styles.checked,
                          ]}
                        >
                          <ThemedText style={styles.checkText}>
                            {todo.completed ? '✓' : ''}
                          </ThemedText>
                        </Pressable>
                        <Pressable
                          onPress={() => toggleTodo(todo.id)}
                          onLongPress={() => deleteTodo(todo.id)}
                          style={styles.todoTitleButton}
                        >
                          <ThemedText
                            style={[
                              styles.todoTitle,
                              todo.completed &&
                                styles.todoCompleted,
                            ]}
                          >
                            {todo.title}
                          </ThemedText>
                        </Pressable>
                        <Pressable
                          accessibilityLabel={`Delete ${todo.title}`}
                          onPress={() => deleteTodo(todo.id)}
                          style={styles.todoDeleteButton}
                        >
                          <ThemedText style={styles.todoDeleteText}>
                            ×
                          </ThemedText>
                        </Pressable>
                      </View>
                    ))}
                  </ThemedView>
                )}
              </ThemedView>

              <ThemedView style={styles.statsRow}>
                <ThemedView style={styles.statCard}>
                  <ThemedText style={styles.statNumber}>
                    {bestStreak}
                  </ThemedText>
                  <ThemedText style={styles.statLabel}>
                    Current streak
                  </ThemedText>
                </ThemedView>

                <ThemedView style={styles.statCard}>
                  <ThemedText style={styles.statNumber}>
                    {totalCompleted}
                  </ThemedText>
                  <ThemedText style={styles.statLabel}>
                    Total completions
                  </ThemedText>
                </ThemedView>
              </ThemedView>

              <ThemedView style={styles.motivation}>
                <ThemedText style={styles.motivationIcon}>
                  🔥
                </ThemedText>

                <ThemedView style={styles.motivationText}>
                  <ThemedText type="smallBold">
                    Keep your streak alive!
                  </ThemedText>

                  <ThemedText style={styles.target}>
                    Small steps every day lead to big results.
                  </ThemedText>
                </ThemedView>
              </ThemedView>
            </>
          )}

          {/* HISTORY */}
          {activeTab === 'history' && (
            <>
              <ThemedText type="subtitle" style={styles.pageTitle}>
                Last 7 days
              </ThemedText>

              <ThemedView style={styles.historyCard}>
                {getLastSevenDays().map((day) => {
                  const scheduled = habits.filter((habit) =>
                    isScheduledOnDate(
                      habit.schedule,
                      day.date
                    )
                  );

                  const completed = scheduled.filter(
                    (habit) =>
                      habit.completions[day.key]
                  ).length;

                  return (
                    <ThemedView
                      key={day.key}
                      style={styles.historyRow}
                    >
                      <ThemedText style={styles.historyDay}>
                        {day.label}
                      </ThemedText>

                      <ThemedView
                        style={styles.historyBar}
                      >
                        <View
                          style={[
                            styles.historyFill,
                            {
                              width:
                                scheduled.length === 0
                                  ? '0%'
                                  : `${
                                      (completed /
                                        scheduled.length) *
                                      100
                                    }%`,
                            },
                          ]}
                        />
                      </ThemedView>

                      <ThemedText style={styles.historyCount}>
                        {completed}/{scheduled.length}
                      </ThemedText>
                    </ThemedView>
                  );
                })}
              </ThemedView>
            </>
          )}

          {/* INSIGHTS */}
          {activeTab === 'insights' && (
            <>
              <ThemedText type="subtitle" style={styles.pageTitle}>
                Your insights
              </ThemedText>

              <ThemedView style={styles.insightCard}>
                <ThemedText style={styles.insightNumber}>
                  {Math.round(progress * 100)}%
                </ThemedText>

                <ThemedText type="subtitle">
                  Today's completion
                </ThemedText>

                <ThemedText style={styles.muted}>
                  {completedToday} of {todaysHabits.length}{' '}
                  habits completed today.
                </ThemedText>
              </ThemedView>

              <ThemedView style={styles.insightCard}>
                <ThemedText style={styles.insightNumber}>
                  {bestStreak}
                </ThemedText>

                <ThemedText type="subtitle">
                  Current best streak
                </ThemedText>

                <ThemedText style={styles.muted}>
                  Keep completing habits consistently to
                  grow your streak.
                </ThemedText>
              </ThemedView>

              <ThemedView style={styles.insightCard}>
                <ThemedText style={styles.insightNumber}>
                  {habits.length}
                </ThemedText>

                <ThemedText type="subtitle">
                  Active habits
                </ThemedText>

                <ThemedText style={styles.muted}>
                  Your current HabitFlow routine.
                </ThemedText>
              </ThemedView>
            </>
          )}
        </ScrollView>

        {/* ADD HABIT MODAL */}
        <Modal
          visible={showAddModal}
          animationType="slide"
          transparent
          onRequestClose={() =>
            setShowAddModal(false)
          }
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modal}>
              <ThemedText type="title" style={styles.modalTitle}>
                Add Habit
              </ThemedText>

              <TextInput
                value={newName}
                onChangeText={setNewName}
                placeholder="Habit name"
                placeholderTextColor="#888"
                style={styles.input}
              />

              <TextInput
                value={newTarget}
                onChangeText={setNewTarget}
                placeholder="Target e.g. 30 minutes"
                placeholderTextColor="#888"
                style={styles.input}
              />

              <TextInput
                value={newIcon}
                onChangeText={setNewIcon}
                placeholder="Icon e.g. 🏃"
                placeholderTextColor="#888"
                style={styles.input}
              />

              <Pressable
                style={styles.timePickerButton}
                onPress={() => setShowTimePicker(true)}
              >
                <ThemedText>
                  {newReminder || 'Choose reminder time'}
                </ThemedText>
              </Pressable>

              {showTimePicker && (
                <DateTimePicker
                  value={reminderTime}
                  mode="time"
                  is24Hour
                  display="default"
                  onChange={(event, selectedTime) => {
                    setShowTimePicker(false);

                    if (!selectedTime) return;

                    setReminderTime(selectedTime);

                    const hours = selectedTime
                      .getHours()
                      .toString()
                      .padStart(2, '0');
                    const minutes = selectedTime
                      .getMinutes()
                      .toString()
                      .padStart(2, '0');

                    setNewReminder(`${hours}:${minutes}`);
                  }}
                />
              )}

              <ThemedText style={styles.inputLabel}>
                Schedule
              </ThemedText>

              <View style={styles.scheduleRow}>
                {(
                  [
                    'daily',
                    'weekdays',
                    'weekends',
                  ] as Schedule[]
                ).map((schedule) => (
                  <Pressable
                    key={schedule}
                    onPress={() =>
                      setNewSchedule(schedule)
                    }
                    style={[
                      styles.scheduleButton,
                      newSchedule === schedule &&
                        styles.scheduleButtonActive,
                    ]}
                  >
                    <ThemedText style={styles.scheduleText}>
                      {schedule}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>

              <View style={styles.modalButtons}>
                <Pressable
                  onPress={() =>
                    setShowAddModal(false)
                  }
                  style={styles.cancelButton}
                >
                  <ThemedText>Cancel</ThemedText>
                </Pressable>

                <Pressable
                  onPress={addHabit}
                  style={styles.saveButton}
                >
                  <ThemedText style={styles.saveText}>
                    Save Habit
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </ThemedView>
  );
}

function isScheduledOnDate(
  schedule: Schedule,
  date: Date
) {
  const day = date.getDay();

  if (schedule === 'daily') return true;

  if (schedule === 'weekdays') {
    return day >= 1 && day <= 5;
  }

  return day === 0 || day === 6;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  safeArea: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 20,
    paddingBottom: 50,
  },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  header: {
    paddingTop: 20,
    paddingBottom: 18,
  },

  greeting: {
    fontSize: 15,
    opacity: 0.65,
    marginBottom: 4,
  },

  title: {
    fontSize: 34,
    marginBottom: 4,
  },

  date: {
    fontSize: 14,
    opacity: 0.55,
  },

  tabs: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 14,
    marginBottom: 20,
  },

  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },

  activeTab: {
    backgroundColor: '#4CAF50',
  },

  progressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 22,
    marginBottom: 26,
  },

  progressCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 7,
    borderColor: '#4CAF50',
    marginRight: 18,
  },

  progressNumber: {
    fontSize: 18,
    fontWeight: '700',
  },

  progressLabel: {
    fontSize: 10,
    opacity: 0.6,
  },

  progressInfo: {
    flex: 1,
  },

  progressDescription: {
    marginTop: 5,
    fontSize: 13,
    opacity: 0.65,
    lineHeight: 18,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  count: {
    fontSize: 13,
    opacity: 0.6,
  },

  addButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#4CAF50',
  },

  addButtonText: {
    color: '#fff',
    fontWeight: '700',
  },

  habitList: {
    gap: 12,
  },

  todoSection: {
    marginTop: 28,
  },

  todoInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },

  todoInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 14,
    color: '#111',
    backgroundColor: '#fafafa',
  },

  todoAddButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 58,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#4CAF50',
  },

  todoList: {
    gap: 8,
  },

  todoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(128,128,128,0.08)',
  },

  todoCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#999',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  todoTitleButton: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 12,
  },

  todoTitle: {
    fontSize: 15,
  },

  todoCompleted: {
    textDecorationLine: 'line-through',
    opacity: 0.55,
  },

  todoDeleteButton: {
    padding: 8,
    marginLeft: 4,
  },

  todoDeleteText: {
    fontSize: 24,
    lineHeight: 24,
    opacity: 0.55,
  },

  habitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 18,
  },

  completedCard: {
    opacity: 0.7,
  },

  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  icon: {
    fontSize: 24,
  },

  habitInfo: {
    flex: 1,
  },

  target: {
    fontSize: 13,
    opacity: 0.6,
    marginTop: 3,
  },

  check: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#999',
    alignItems: 'center',
    justifyContent: 'center',
  },

  checked: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },

  checkText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },

  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },

  statCard: {
    flex: 1,
    padding: 18,
    borderRadius: 18,
  },

  statNumber: {
    fontSize: 26,
    fontWeight: '700',
  },

  statLabel: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 4,
  },

  motivation: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 18,
    marginTop: 24,
  },

  motivationIcon: {
    fontSize: 26,
    marginRight: 14,
  },

  motivationText: {
    flex: 1,
  },

  emptyCard: {
    alignItems: 'center',
    padding: 30,
    borderRadius: 18,
    gap: 8,
  },

  muted: {
    opacity: 0.6,
    marginTop: 5,
  },

  pageTitle: {
    marginBottom: 16,
  },

  historyCard: {
    padding: 18,
    borderRadius: 20,
    gap: 18,
  },

  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  historyDay: {
    width: 42,
    fontSize: 13,
  },

  historyBar: {
    flex: 1,
    height: 8,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#ddd',
    marginHorizontal: 10,
  },

  historyFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 8,
  },

  historyCount: {
    width: 38,
    textAlign: 'right',
    fontSize: 12,
    opacity: 0.65,
  },

  insightCard: {
    padding: 22,
    borderRadius: 20,
    marginBottom: 14,
  },

  insightNumber: {
    fontSize: 34,
    fontWeight: '700',
    marginBottom: 5,
  },

  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },

  modal: {
    padding: 22,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: '#fff',
  },

  modalTitle: {
    marginBottom: 18,
  },

  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
    color: '#111',
    backgroundColor: '#fafafa',
  },

  timePickerButton: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
  },

  inputLabel: {
    fontSize: 13,
    marginBottom: 8,
    opacity: 0.7,
  },

  scheduleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },

  scheduleButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },

  scheduleButtonActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },

  scheduleText: {
    fontSize: 12,
    textTransform: 'capitalize',
  },

  modalButtons: {
    flexDirection: 'row',
    gap: 10,
  },

  cancelButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },

  saveButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#4CAF50',
  },

  saveText: {
    color: '#fff',
    fontWeight: '700',
  },
});