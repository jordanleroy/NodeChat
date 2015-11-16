var net  = require('net'); //import de la lib net

var clients_array = [];

net.createServer(function(socket) {
    socket.setEncoding('utf8');

    socket.on('data', function(data) {
        var json_data = JSON.parse(data);
        switch (json_data.type) {
            case 'connectionRequest': // CLIENT wants to connect
                connectClient(socket, json_data);
                break;
            case 'joinGroup': // CLIENT wants to join a group
                addClientToGroup(socket, json_data);
                break;
            case 'leaveGroup': // CLIENT wants to leave a group
                removeClientFromGroup(socket, json_data);
                break;
            case 'connectionEnd': // CLIENT wants to disconnect
                disconnectClient(socket);
                break;
            case 'listGroups': // CLIENT wants to know the groups he's connected to
                listGroupsForClient(socket);
                break;
            case 'listMembers': // CLIENT wants to know the participants of a specified group
                listMembersOfGroup(socket, json_data);
                break;
            case 'message': // CLIENT wants to send a message
                sendMessage(socket, json_data);
                break;
        }
    });
    socket.on('error', console.error);
}).listen(8080, '127.0.0.1');


var os = require('os');
var interfaces = os.networkInterfaces();
console.dir(interfaces);


function connectClient(socket, json_data) {
    socket.id     = generateUID(); // Generate unique ID in case two clients have the same name
    socket.name   = json_data.name;
    socket.groups = ['general'];


    socket.write(JSON.stringify({
        type : 'connectionConfirmation',
        id   : socket.id
    }));

    // Tell GENERAL group that this client is connected
    sendGroupMessage(socket, 'general', 'Hey! I\'ve just arrived :)');

    console.log('%s (%s) s\'est connecté.', socket.name, socket.id);

    // Add client to our local client list
    clients_array.push(socket);
}


function addClientToGroup(socket, json_data) {
    socket.groups.push(json_data.groupToJoin);
    socket.write(JSON.stringify({
        type   : 'joinGroupConfirmation',
        groups : socket.groups
    }));

    // Tell group participants that this client has joined the group
    sendGroupMessage(socket, json_data.groupToJoin, 'Hey! I\'ve just arrived :)');
}


function removeClientFromGroup(socket, json_data) {
    var group_index = socket.groups.indexOf(json_data.groupToLeave);
    if (group_index > -1) {
        socket.groups.splice(group_index, 1);
        socket.write(JSON.stringify({
            type      : 'leaveGroupConfirmation',
            leftGroup : json_data.groupToLeave
        }));
    } else {
        socket.write(JSON.stringify({
            type: 'error',
            cause: 'You do not belong to this group'
        }));
    }
}


function disconnectClient(socket) {
    console.error('%s (%s) s\'est déconnecté.', socket.name, socket.id);

    socket.write(JSON.stringify({
        type : 'disconnectionConfirmation'
    }));

    // Remove client from our local list
    var client_index = clients_array.indexOf(socket);
    clients_array.splice(client_index, 1);
}


function listGroupsForClient(socket) {
    socket.write(JSON.stringify({
        type   : 'listOfGroups',
        groups : socket.groups
    }));
}


function listMembersOfGroup(socket, json_data) {
    var members = [];
    var list_group_index = socket.groups.indexOf(json_data.groupToList);
    if (list_group_index > -1) {
        clients_array.forEach(function(client) {
            list_group_index = client.groups.indexOf(json_data.groupToList);
            if (list_group_index > -1) members.push(client.name);
        });

        socket.write(JSON.stringify({
            type    : 'listOfMembersOfAGroup',
            group   : json_data.groupToList,
            members : members
        }));
    } else {
        socket.write(JSON.stringify({
            type  : 'error',
            cause : 'you do not belong to this group'
        }));
    }
}


function sendMessage(socket, json_data) {
    // Check the 'to' property to see the desired recipients
    switch (json_data.destination) {
        case 'broadcast': //write to all persons connected to the groups the user belongs to
            sendBroadcastMessage(socket, json_data);
            break;
        case 'unicast': //write to only one person
            sendSingleMessage(socket, json_data);
            break;
        case 'multicast': //write to all members of the specified group
            sendGroupMessage(socket, json_data.groupName, json_data.message);
            break;
        default:
            console.error('');
            break;

    }
}


function sendBroadcastMessage(socket, json_data) {
    clients_array.forEach(function(client) {
        if (socket.id !== client.id) {
            client.write(JSON.stringify({
                type        : 'message',
                destination : 'BROADCAST',
                sender      : socket.name,
                message     : json_data.message
            }));
        }
    });
}


function sendSingleMessage(socket, json_data) {
    if ( !clients_array.some(function (client){ // this function return false if it doesn't find any client
        if (client.name === json_data.receiver) {
            client.write(JSON.stringify({
                type        : 'message',
                destination : 'PRIVATE',
                sender      : socket.name,
                message     : json_data.message
            }));
            return true;
        }
    })) {
        socket.write(JSON.stringify({
            type: 'error',
            cause: 'Client not found',
            howTo: 'Please check the client name for typos'
        }));
    }
}


function sendGroupMessage(socket, groupName, message) {
    if (socket.groups.indexOf(groupName) > -1) { // Verify the user belongs to the group
        clients_array.forEach(function (client){
            if (socket.id !== client.id && client.groups.indexOf(groupName) > -1) {
                client.write(JSON.stringify({
                    type        : 'message',
                    destination : groupName,
                    sender      : socket.name,
                    message     : message
                }));
            }
        });
    } else {
        socket.write(JSON.stringify({
            type: 'error',
            cause: 'You have not subscribed to this group',
            howTo: 'please use \'--join groupName\' command'
        }));
    }
}


function generateUID() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    }
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}
