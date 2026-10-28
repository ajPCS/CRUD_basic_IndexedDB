// ----------------------------------------------------------------
// Simple To-Do App using plain JavaScript and the browser's
// built-in IndexedDB database.
// ----------------------------------------------------------------

// Name and version of our IndexedDB database, and the name of the
// "object store" (similar to a table) where we keep our tasks.
const DB_NAME = 'todoAppDB';
const DB_VERSION = 1;
const STORE_NAME = 'tasks';

// This variable will hold the open database connection once it's ready.
let db;

// Opens (or creates) the IndexedDB database. Returns a Promise so we
// can use async/await when calling it.
function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        // Runs the first time the database is created, or when the
        // version number changes. This is where we set up the store.
        request.onupgradeneeded = function (event) {
            const database = event.target.result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                // "id" will be created automatically for every task.
                database.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            }
        };

        request.onsuccess = function (event) {
            db = event.target.result;
            resolve(db);
        };

        request.onerror = function (event) {
            console.error('Error opening database:', event.target.error);
            reject(event.target.error);
        };
    });
}

// ---------------------- CRUD functions ----------------------

// Create: adds a new task to the database.
function createTask(name, details, dueDate) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.add({ name, details, dueDate });

        request.onsuccess = function () {
            resolve(request.result); // the new task's id
        };
        request.onerror = function (event) {
            console.error('Error creating task:', event.target.error);
            reject(event.target.error);
        };
    });
}

// Read: gets every task currently stored in the database.
function getTasks() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = function () {
            resolve(request.result); // an array of task objects
        };
        request.onerror = function (event) {
            console.error('Error fetching tasks:', event.target.error);
            reject(event.target.error);
        };
    });
}

// Update: changes the fields of an existing task.
// "updates" is an object with the new values, e.g. { name: 'New name' }.
function updateTask(id, updates) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const getRequest = store.get(id);

        getRequest.onsuccess = function () {
            const task = getRequest.result;
            if (!task) {
                reject(new Error('Task not found'));
                return;
            }

            // Merge the existing task with the new values.
            const updatedTask = Object.assign(task, updates);
            const putRequest = store.put(updatedTask);

            putRequest.onsuccess = function () {
                resolve(updatedTask);
            };
            putRequest.onerror = function (event) {
                console.error('Error updating task:', event.target.error);
                reject(event.target.error);
            };
        };
        getRequest.onerror = function (event) {
            console.error('Error finding task to update:', event.target.error);
            reject(event.target.error);
        };
    });
}

// Delete: removes a task from the database.
function deleteTask(id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = function () {
            resolve();
        };
        request.onerror = function (event) {
            console.error('Error deleting task:', event.target.error);
            reject(event.target.error);
        };
    });
}

// ---------------------- Page/UI functions ----------------------

// Fills the dropdown list with the names of every saved task.
async function populateTasksDropdown() {
    const tasks = await getTasks();
    const dropdown = document.getElementById('taskDropdown');
    dropdown.innerHTML = '<option value="">Select a task</option>';
    tasks.forEach(task => {
        const option = document.createElement('option');
        option.value = task.id;
        option.textContent = task.name;
        dropdown.appendChild(option);
    });
}

// Shows the details (and edit form) for whichever task is selected
// in the dropdown.
async function displayTaskDetails() {
    const dropdown = document.getElementById('taskDropdown');
    const taskId = Number(dropdown.value);
    const detailsDiv = document.getElementById('taskDetails');

    if (!taskId) {
        detailsDiv.innerHTML = '';
        return;
    }

    const tasks = await getTasks();
    const task = tasks.find(t => t.id === taskId);
    if (!task) {
        detailsDiv.innerHTML = '';
        return;
    }

    detailsDiv.innerHTML = `
        <h3>${task.name}</h3>
        <p>${task.details}</p>
        <p>Due Date: ${task.dueDate}</p>
        <button type="button" class="btn btn-danger" onclick="handleDelete(${task.id})">Delete</button>
        <button type="button" class="btn btn-secondary" onclick="showEditForm(${task.id})">Edit</button>

        <form id="editForm" class="mt-3 d-none">
            <label for="editName" class="form-label">Task Name:</label>
            <input type="text" class="form-control" id="editName" value="${task.name}" required><br>

            <label for="editDetails" class="form-label">Details</label>
            <textarea class="form-control" id="editDetails" required>${task.details}</textarea><br>

            <label for="editDueDate" class="form-label">Due Date</label>
            <input type="date" class="form-control" id="editDueDate" value="${task.dueDate}" required><br><br>

            <button type="submit" class="btn btn-primary">Save Changes</button>
        </form>
    `;

    // Attach the submit handler now that the form exists in the page.
    document.getElementById('editForm').addEventListener('submit', async function (event) {
        event.preventDefault();
        const updates = {
            name: document.getElementById('editName').value,
            details: document.getElementById('editDetails').value,
            dueDate: document.getElementById('editDueDate').value
        };
        await updateTask(task.id, updates);
        await populateTasksDropdown();
        dropdown.value = task.id;
        await displayTaskDetails();
    });
}

// Reveals the edit form so the user can change the task's fields.
function showEditForm() {
    document.getElementById('editForm').classList.remove('d-none');
}

// Deletes the selected task and refreshes the page's lists.
async function handleDelete(id) {
    await deleteTask(id);
    await populateTasksDropdown();
    document.getElementById('taskDetails').innerHTML = '';
}

// ---------------------- Start the app ----------------------

async function init() {
    await openDatabase();
    await populateTasksDropdown();

    // Wire up the "create task" form.
    document.getElementById('taskForm').addEventListener('submit', async function (event) {
        event.preventDefault();
        const name = document.getElementById('name').value;
        const details = document.getElementById('details').value;
        const dueDate = document.getElementById('dueDate').value;

        await createTask(name, details, dueDate);
        await populateTasksDropdown();
        event.target.reset();
        alert('Task created successfully!');
    });

    // Wire up the dropdown so selecting a task shows its details.
    document.getElementById('taskDropdown').addEventListener('change', displayTaskDetails);
}

init();
