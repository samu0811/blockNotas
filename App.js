import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  StatusBar,
  Alert,
  ScrollView,
  registerCallableModule,
  Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false
  })
});

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('personal');
  const [activeFilter, setActiveFilter] = useState('all');

  const [reminderSeconds, setReminderSeconds] = useState("");

  // 1. CARGAR NOTAS: Se ejecuta UNA SOLA VEZ cuando la app se abre
  useEffect(() => {
    registerForPushNotificationsAsync();
    loadTasks();
  }, []);

  // 2. GUARDAR AUTOMÁTICO: Cada vez que el arreglo 'tasks' cambie, lo guardamos en el chip
  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  const registerForPushNotificationsAsync = async () => {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
  };

  //funcion para leer las notas guardadas en el chip
  const loadTasks = async () => {
    try {
      const savedTasks = await AsyncStorage.getItem('@my_tasks');
      if (savedTasks !== null) {
        setTasks(JSON.parse(savedTasks));// Convertimos el texto plano de vuelta a un arreglo
      }
    } catch (error) {
      console.error('Error al cargar las notas:', error);
    }
  };

  //funcion para guardar las notas en el chip
  const saveTasks = async (tasksToSave) => {
    try {
      await AsyncStorage.setItem('@my_tasks', JSON.stringify(tasksToSave));// Convertimos el arreglo a texto plano
    } catch (error) {
      console.error('Error al guardar las notas:', error);
    }
  };

  const CreateUser = async (username, password) => {

    if (username.trim() === "" || password.trim() === "") {
      Alert.alert("Error", "Por favor, ingresa un nombre de usuario y una contraseña.");
      return;
    }

    try {
      await AsyncStorage.setItem('@my_user', JSON.stringify({ username, password }));
    } catch (error) {
      console.error('Error al guardar el usuario:', error);
    }

    const newUser = {
      username: username,
      password: password
    };
    setUsers([...users, newUser]);

    setUsername('');
    setPassword('');
    setIsLoading(false);
  };

  const handleSaveOrUpdate = async () => {
    if (title.trim() === "") return;

    let notificationId = null;

    if (reminderSeconds.trim() !== '') {
      const seconds = parseInt(reminderSeconds, 10);
      if (!isNaN(seconds) && seconds > 0) {
        try {
          notificationId = await Notifications.scheduleNotificationAsync({
            content: {
              title: `🔔 Recordatorio: ${title}`,
              body: description || 'Tienes esta nota pendiente de realizar.',
              sound: true,
            },
            trigger: { seconds: seconds },
          });
          Alert.alert('Recordatorio Programado', `Te notificaremos en ${seconds} segundos.`);
        } catch (error) {
          console.log("Error al programar notificación: ", error);
        }
      }
    }

    if (editingTaskId) {
      // Actualizar nota existente
      const updatedTasks = tasks.map(task => {
        if (task.id === editingTaskId) {
          if (task.notificationId) {
            Notifications.cancelAllScheduledNotificationsAsync(task.notificationId).catch(() => { });
          }
          return { ...task, title: title, description: description, category: selectedCategory, notificationId: notificationId || task.notificationId };
        }
        return task;
      });
      setTasks(updatedTasks);
      setEditingTaskId(null); // Limpiar el estado de edición
    } else {
      // Crear nueva nota

      const newTask = {
        id: Date.now().toString(),
        title: title,
        description: description,
        completed: false,
        category: selectedCategory,
        notificationId: notificationId
      };
      setTasks([newTask, ...tasks]);
    }
    setTitle('');
    setDescription('');
    setReminderSeconds('');
    setSelectedCategory('personal');
    setIsFormVisible(false);
  };

  const startEdit = (task) => {
    setTitle(task.title);
    setDescription(task.description);
    setSelectedCategory(task.category || 'personal');
    setEditingTaskId(task.id);
    setIsFormVisible(true);
  };

  const startLoading = () => {
    setIsLoading(true);
  };
  const stopLoading = () => {
    setIsLoading(false);
  }

  //funcion para marcar como checked o desmarcar una nota
  const toggleTaskCompletion = (id) => {
    const updateTask = tasks.map(task => {
      if (task.id === id) {
        return { ...task, completed: !task.completed };
      }
      return task;
    });
    setTasks(updateTask);
  };

  const deleteUser = async (id) => {
    Alert.alert(
      "Eliminar Usuario",
      "¿Estás seguro de que deseas eliminar este usuario?",
      [
        {
          text: "Cancelar",
          style: "cancel"
        },
        {
          text: "Eliminar",
          onPress: async () => {
            const filterUser = users.filter(user => user.id !== id);
            setUsers(filterUser);
            setIsLoading(false);
          }
        }
      ]
    );
  };

  //funcion para eliminar la nota
  const deleteTask = (id) => {
    Alert.alert(
      "Eliminar Nota",
      "¿Estás seguro de que deseas eliminar esta nota?",
      [
        {
          text: "Cancelar",
          style: "cancel"
        },
        {
          text: "Eliminar",
          onPress: () => {
            const filterTask = tasks.filter(task => task.id !== id);
            setTasks(filterTask);

            if (filterTask && filterTask.notificationId) {
              Notifications.cancelScheduledNotificationAsync(taskToDelete.notificationId).catch(() => { });
            }
            if (editingTaskId === id) {
              setEditingTaskId(null);
              setTitle('');
              setDescription('');
              setIsFormVisible(false);
            }
          }
        }
      ]
    );
  };

  const closeForm = () => {
    setIsFormVisible(false);
    setEditingTaskId(null);
    setReminderSeconds('');
    setSelectedCategory('personal')
    setTitle('');
    setDescription('');
  }

  const CATEGORIES = [
    { id: 'all', name: 'Todas', emoji: '📂', color: '#007AFF' },
    { id: 'work', name: 'Trabajo', emoji: '💼', color: '#FF9500' },
    { id: 'personal', name: 'Personal', emoji: '🏠', color: '#34C759' },
    { id: 'shopping', name: 'Compras', emoji: '🛒', color: '#FF3B30' },
    { id: 'ideas', name: 'Ideas', emoji: '💡', color: '#AF52DE' },
    { id: 'estudio', name: 'Estudio', emoji: '📚', color: '#5AC8FA' },
  ];

  const filteredTask = activeFilter === 'all'
    ? tasks
    : tasks.filter(tasks => tasks.category === activeFilter);

  const getCategoryColor = (categoryId) => {
    const cat = CATEGORIES.find(c => c.id === categoryId);
    return cat ? cat.color : '#007AFF';
  };

  const getCategoryEmoji = (categoryId) => {
    const cat = CATEGORIES.find(c => c.id === categoryId);
    return cat ? cat.emoji : '🗒️';
  };


  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.headercontainer}>
        <Text style={styles.headerTitle}>📝 Mi Bloc Personal
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 20, }}>
          <TouchableOpacity style={styles.addButtonTop} onPress={() => setIsLoading(true)}>
            <Text style={styles.addButtonTopText}>👤</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ marginBottom: 5, paddingHorizontal: 20 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContainer}>

          {CATEGORIES.map(cat => {
            const isActive = activeFilter === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.filterChip,
                  isActive ? { backgroundColor: cat.color } : null
                ]}
                onPress={() => setActiveFilter(cat.id)}
              >

                <Text style={[
                  styles.filterChipText,
                  isActive ? styles.filterChipTextActive : null]
                }>
                  {cat.emoji} {cat.name}
                </Text>
              </TouchableOpacity>
            );
          }
          )}
        </ScrollView>
      </View>

      {isLoading && (
        <View style={styles.form}>
          <Text style={styles.formTitle}>Usuario</Text>
          <TextInput
            style={styles.input}
            placeholder="Nombre de usuario..."
            placeholderTextColor="#888"
            value={username}
            onChangeText={setUsername}
          />
          <TextInput
            style={styles.input}
            placeholder="Contraseña..."
            placeholderTextColor="#888"
            secureTextEntry={true}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity style={[styles.button, styles.buttonlog]} onPress={() => CreateUser(username, password)}>
            <Text style={styles.cancelEditButtonText}>LOGGIN</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.buttonCancel, styles.buttonVolver]} onPress={() => setIsLoading(false)}>
            <Text style={styles.cancelEditButtonText} >
              Volver
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {isFormVisible ? (
        <ScrollView style={styles.formContainer}>
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Título de la nota..."
              placeholderTextColor="#888"
              value={title}
              onChangeText={setTitle}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Descripción (opcional)..."
              placeholderTextColor="#888"
              multiline={true}
              numberOfLines={3}
              value={description}
              onChangeText={setDescription}
            />

            <TextInput
              style={styles.input}
              placeholder='deja vacio para no alarma'
              placeholderTextColor="#888"
              keyboardType="numeric"
              value={reminderSeconds}
              onChangeText={setReminderSeconds}
            />

            <View style={styles.categorySelector}>
              {CATEGORIES.filter(c => c.id !== 'all').map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryOption,
                    selectedCategory === cat.id && { borderColor: cat.color, backgroundColor: cat.color + '15' }
                  ]}
                  onPress={() => setSelectedCategory(cat.id)}
                >
                  <Text style={styles.categoryOptionText}>{cat.emoji}</Text>
                  <Text style={[
                    styles.categoryOptionLabel,
                    selectedCategory === cat.id && { color: cat.color, fontWeight: 'bold' }
                  ]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={[styles.button, editingTaskId && styles.buttonUpdate]} onPress={handleSaveOrUpdate}>
              <Text style={styles.buttonText}>{editingTaskId ? 'Actualizar Nota 💾' : 'Guardar Nota'}</Text>
            </TouchableOpacity>

            {!editingTaskId && (
              <TouchableOpacity style={styles.buttonCancel} onPress={closeForm}>
                <Text style={styles.buttonTextCancel}>Cerrar Formulario ❌</Text>
              </TouchableOpacity>
            )}

            {/* Si estamos editando, mostramos un botón extra para poder Cancelar la edición */}
            {editingTaskId && (
              <TouchableOpacity style={[styles.button, styles.buttonCancel]} onPress={() => { closeForm(); setEditingTaskId(null); setTitle(''); setDescription(''); }}>
                <Text style={styles.cancelEditButtonText}>Cancelar Edición ❌</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      ) : null}

      {/**este muestra la lista de usuarios, si existen */}
      {isLoading && users.length > 0 && (
        <View style={styles.form}>
          <Text style={styles.formTitle}>Usuarios Registrados</Text>
          {users.length === 0 ? (
            <Text style={styles.emptyText}>No hay usuarios registrados.</Text>
          ) : (
            <FlatList
              data={users}
              keyExtractor={(item, index) => index.toString()}
              renderItem={({ item }) => (
                <View style={styles.taskCard}>
                  <Text style={styles.taskTitle}>{item.username}</Text>
                  <TouchableOpacity style={[styles.actionButton, styles.deleteButton]} onPress={() => deleteUser(item.id)}>
                    <Text style={styles.actionButtonText}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              )}
            />
          )}
          <TouchableOpacity style={[styles.buttonCancel, styles.buttonVolver]} onPress={() => setIsLoading(false)}>
            <Text style={styles.cancelEditButtonText} >
              Volver
            </Text>
          </TouchableOpacity>


        </View>
      )}

      {/**Muestra la lista de notas si existen, si no hay muestra mensaje que no hay notas */}
      {isFormVisible === false && isLoading === false && (
        <FlatList
          data={filteredTask}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item }) => (
            <View style={[styles.taskCard, item.completed ? styles.taskCardCompleted : null, { borderLeftColor: getCategoryColor(item.category) }]}>
              <View style={styles.taskTextContainer}>
                {/* Título (se tacha si está completado) */}
                <Text style={[styles.taskTitle, item.completed && styles.textCompleted]}>{getCategoryEmoji(item.category)}{item.title}</Text>

                {item.description ? <Text style={[styles.taskDesc, item.completed && styles.textCompleted]}>{item.description}</Text> : null}
                {item.notificationId && !item.completed && (
                  <Text style={styles.reminderBadge}>⏰ Alarma programada</Text>
                )}
              </View>

              {/* Botón para marcar como completado */}
              <View style={styles.actions}>
                {/**boton de check */}
                <TouchableOpacity
                  style={[styles.actionButton, styles.checkButton]}
                  onPress={() => toggleTaskCompletion(item.id)}>
                  <Text style={styles.actionButtonText}>{item.completed ? '✔️' : '⭕'}</Text>
                </TouchableOpacity>


                <TouchableOpacity
                  style={[styles.actionButton, styles.editButton]}
                  onPress={() => startEdit(item)}>
                  <Text style={styles.actionButtonText}>✏️</Text>
                </TouchableOpacity>


                <TouchableOpacity
                  style={[styles.actionButton, styles.deleteButton]}
                  onPress={() => deleteTask(item.id)}>
                  <Text style={styles.actionButtonText}>🗑️</Text>
                </TouchableOpacity>

              </View>

            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No hay notas guardadas aún. ¡Escribe una!</Text>
          }
        />
      )}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.addButtonTop} onPress={() => setIsFormVisible(true)}>
          <Text style={styles.addButtonTopText}>➕</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}



const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    paddingTop: 30, // Añadimos espacio arriba manualmente para evitar el choque con la barra de estado
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    alignItems: 'flex-end',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 20,
    color: '#333'
  },
  listContainer: {
    paddingBottom: 100, // 👈 Deja un colchón invisible de 100px abajo
  },
  filtersContainer: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    gap: 8
  },
  filterChip: {
    backgroundColor: '#E5E5EA',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3A3A3C'
  },
  filterChipTextActive: {
    color: '#FFF'
  },
  formContainer: {
    maxHeight: '75%',
    marginHorizontal: 15,
    marginBottom: 20
  },
  form: {
    padding: 20,
    backgroundColor: '#FFF',
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#555'
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 6,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
    backgroundColor: '#FAFAFA'
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top'
  },

  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 6
  },
  categorySelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
    gap: 5
  },
  categoryOption: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#FAFAFA'
  },
  categoryOptionText: {
    fontSize: 18,
    marginBottom: 2
  },
  categoryOptionLabel: {
    fontSize: 9,
    color: '#8E8E93'
  },
  addButtonTop: {
    position: 'absolute', // Hace que flote sobre la pantalla
    bottom: 30,           // Distancia desde abajo
    right: 10,            // Distancia desde la derecha
    backgroundColor: '#007AFF',
    width: 60,            // Un poco más grande para que sea fácil de pulsar con el pulgar
    height: 60,
    borderRadius: 30,     // Completamente redondo
    justifyContent: 'center',
    alignItems: 'center',// Sombras premium para que parezca que realmente flota sobre las notas
    elevation: 8,         // Sombra para Android
    shadowColor: '#000',  // Sombra para iOS
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  addButtonTopText: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: -2
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#555'
  },
  form: {
    padding: 20,
    backgroundColor: '#FFF',
    marginHorizontal: 15,
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    marginBottom: 20
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 6,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
    backgroundColor: '#FAFAFA'
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top'
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 15,
    alignItems: 'center'
  },
  buttonCancel: {
    backgroundColor: '#FF3B30',
    padding: 15,
    borderRadius: 15,
    alignItems: 'center',
  },
  buttonUpdate: {
    backgroundColor: '#34e827'
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold'
  },
  buttonTextCancel: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelEditButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold'
  },
  taskCard: {
    backgroundColor: '#FFF',
    padding: 15,
    marginHorizontal: 15,
    marginVertical: 6,
    borderRadius: 8,
    borderLeftWidth: 5,
    borderLeftColor: '#007AFF'
  },
  taskCardCompleted: {
    borderLeftColor: '#28A745',
    backgroundColor: '#EFFFF4'
  },
  tasktextContainer: {
    flex: 1,
    marginRight: 10
  },
  taskTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333'
  },
  taskDesc: {
    fontSize: 14,
    color: '#666',
    marginTop: 5
  },
  actions: {
    flexDirection: 'row',
  },
  actionButton: {
    width: 35,
    height: 35,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8
  },
  checkButton: {
    backgroundColor: '#4CD964',
  },
  editButton: {
    backgroundColor: '#FF9500'
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
  },
  actionButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16
  },
  emptyText: {
    textAlign: 'center',
    color: '#888',
    marginTop: 40,
    fontSize: 16
  }
});