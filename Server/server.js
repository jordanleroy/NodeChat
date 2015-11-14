var net  = require('net'); //import de la lib net
var es   = require('event-stream'); //import de la lib event-stream
var mini = require('minimist'); //import de la lib minimist




var clients_array = [];

// var j;



function guid() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
        s4() + '-' + s4() + s4() + s4();
}


var server = net.createServer(function(socket) {
    socket.setEncoding('utf8');

    socket.on('data', function(data) {
        var json_data = JSON.parse(data);
        if (json_data.type) {


            // CLIENT wants to connect
            if (json_data.type == 'connectionQuery') {
                socket.write(JSON.stringify({
                    type: 'connectionConfirmation',
                    connectionConfirmed: true
                }));
                socket.id     = guid(); // Generate unique ID in case two clients have the same name
                socket.name   = json_data.name;
                socket.groups = ['general'];

                // Tell all participants that this client is connected
                clients_array.forEach(function(client) {
                    client.write(JSON.stringify({
                        type    : 'message',
                        to      : 'all',
                        message : socket.name + ' is now connected'
                    }));
                });

                clients_array.push(socket);
            }

            // CLIENT wants to join a group
            if (json_data.type == 'JoinAGroupQuery') {
                socket.groups.push(json_data.groupToJoin);
                socket.write(JSON.stringify({
                    type         : 'groupConfirmation',
                    message      : 'ok',
                    joinedGroups : socket.groups
                }));

                // Tell group participants that this client has joined the group
                clients_array.forEach(function(client) {
                    if (client.groups.indexOf(json_data.groupToJoin) > -1 && client.id !== socket.id)
                        client.write(JSON.stringify({
                            type    : 'message',
                            message : socket.name + ' has now joined @' + json_data.groupToJoin
                        }));
                });
            }

            // CLIENT wants to leave a group
            if (json_data.type == 'QuitGroup') {
                var group_index = socket.groups.indexOf(json_data.groupToQuit);
                if (group_index > -1) {
                    socket.groups.splice(group_index, 1);
                    socket.write(JSON.stringify({
                        type         : 'QuitGroupConfirmation',
                        joinedGroups : socket.groups
                    }));
                } else {
                    socket.write(JSON.stringify({
                        type  : 'QuitGroupConfirmation',
                        error : 'You don\'t belong to this group'
                    }));
                }
            }

            // CLIENT wants to disconnect
            if (json_data.type == 'connectionEnd') {
                console.log('Fermeture de connexion pour ' + socket.id);

                socket.write(JSON.stringify({
                    type      : 'disconnectionConfirmation',
                    connected : 'false'
                }));

                // Remove client from our local list
                var client_index = clients_array.indexOf(socket);
                clients_array.splice(client_index, 1);
            }

            // CLIENT wants to know the groups he's connected to
            if (json_data.type == 'listOfGroups') {
                socket.write(JSON.stringify({
                    type   : 'listOfGroups',
                    groups : socket.groups
                }));
            }

            // CLIENT wants to know the participants of a specified group
            if (json_data.type == 'listMembers') {
                var members = [];
                var list_group_index = socket.groups.indexOf(json_data.groupToList);
                if (list_group_index > -1) {
                    clients_array.forEach(function(client) {
                        list_group_index = client.groups.indexOf(json_data.groupToList);
                        if (list_group_index > -1) members.push(client.name);
                    });

                    socket.write(JSON.stringify({
                        type  : 'listOfMembersOfAGroup',
                        group : json_data.groupToList,
                        list  : members
                    }));
                } else {
                    socket.write(JSON.stringify({
                        type  : 'listOfMembersOfAGroup',
                        error : 'you don\'t belong to this group'
                    }));
                }
            }

            // CLIENT wants to send a message
            if (json_data.type == 'message') {
                // Check the 'to' property to see the desired recipients
                switch (json_data.to) {
                    case 'all': //write to all persons connected to the NodeChat
                        clients_array.forEach(function(client) {
                            if (socket.id !== client.id) {
                                client.write(JSON.stringify({
                                    type    : 'message',
                                    message : '[BROADCAST][' + socket.name + ']' + json_data.message
                                }));
                            }
                        });
                        break;
                    case 'onePerson': //write to only one person
                        j = 0;
                        var found = false;
                        while (j < clients_array.length && !found) {
                            if (clients_array[j].name == json_data.person) {
                                found = true;
                                clients_array[j].write(JSON.stringify({
                                    type: 'message',
                                    message: '(From ' + socket.name + ' to you) ' + json_data.message
                                }));
                            }
                            j++;
                        }
                        break;
                    case 'group':   //write to all members of the specified group
                        j = 0;
                        while (clients_array[j].id !== socket.id) {
                            j++;
                        }
                        groupToWrite = socket.group;
                        SubscribedGroupsBySocket = clients_array[j].group;
                        if (SubscribedGroupsBySocket.indexOf(json_data.groupName) > -1) {
                            j = 0;
                            while (j < clients_array.length) {
                                if (socket.id !== clients_array[j].id && clients_array[j].group.indexOf(json_data.groupName) > -1) {
                                    clients_array[j].write(JSON.stringify({
                                        type: 'message',
                                        message: '(From ' + socket.name + ' to @' + json_data.groupName + ') ' + json_data.message
                                    }));
                                }
                                j++;
                            }
                        } else {
                            socket.write(JSON.stringify({
                                type: 'error',
                                cause: 'You have not subscribed to this group',
                                howTo: 'please use \'--join groupName\' command'
                            }));
                        }
                        break;
                    default:
                        //display error
                        break;

                }
            }
        }
    });
    socket.on('error', console.error);
});
server.listen(8080, '127.0.0.1');
