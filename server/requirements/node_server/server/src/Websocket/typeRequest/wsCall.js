/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   wsCall.js                                          :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: edbernar <edbernar@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2025/03/11 10:04:07 by edbernar          #+#    #+#             */
/*   Updated: 2025/03/13 15:55:56 by edbernar         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

callInWaiting = [];
usersOcupied = [];

function wsCall (users, content, from, db)
{
	db.isBlockedUser(from, content.id).then(async (res) => {
		try {
			if (res)
			{
				users[from].send({ type: 'error', content: 'You can\'t contact a blocked user' });
				return;
			}
			if (content.action == 'start')
			{
				if (await db.hasMatch(from, content.id, false) === false)
				{
					users[from].send({ type: 'error', content: 'You can only contact a person you matched with' });
					return;
				}
				startCall(users, from, content.id, db);
			}
			else if (content.action == 'accept')
				acceptCall(users, from);
			else if (content.action == 'reject')
				rejectCall(users, from);
			else if (content.action == 'end')
				endCall(users, from);
			else if (content.action == 'voiceData')
				sendVoiceData(users, content.data, from);
			else
				users[from].send({ type: 'error', content: 'Invalid action' });
		}
		catch (err) {}
	});

}

function findPartner(from)
{
	let call = callInWaiting.find(c => c.from == from || c.to == from);

	if (!call)
		return (-1);
	if (call.to == from)
		call = {to: call.from, timeout: call.timeout};
	else
		call = {to: call.to, timeout: call.timeout};
	return (call);
}

async function startCall(users, from, to, db)
{
	if (users[to])
	{
		const user1 = await db.getUserCall(from);
		const user2 = await db.getUserCall(to);

		if (user1 !== null && user2 !== null)
		{
			db.hasMatch(from, to, false).then((res) => {
				if (!res)
				{
					users[from].send({ type: 'error', content: 'You can only call a person you matched with' });
					return;
				}
				if (usersOcupied.includes(from) || usersOcupied.includes(to))
				{
					users[from].send({ type: 'error', content: 'User is already in a call' });
					return;
				}
				users[to].send({ type: 'call', action: 'incoming', from, content: {user1, user2} });
				users[from].send({ type: 'call', action: 'calling', to, content: {user1, user2} });
				usersOcupied.push(from);
				usersOcupied.push(to);
				let timeout = setTimeout(() => {
					const call = findPartner(from);

					if (call === -1)
						return;
					users[to].send({ type: 'call', action: 'end' });
					users[from].send({ type: 'call', action: 'end' });
					usersOcupied = usersOcupied.filter(u => u != from && u != to);
					callInWaiting = callInWaiting.filter(c => c.from != from && c.to != to);
				}, 15000);
				callInWaiting.push({ from, to, timeout });
			});
		}
		else
			users[from].send({ type: 'error', content: 'Error getting user' });
	}
	else
		users[from].send({ type: 'error', content: 'User not connected' });
}

function acceptCall(users, from)
{
	const call = findPartner(from);

	if (call === -1)
	{
		users[from].send({ type: 'error', content: 'Call not found' });
		return;
	}
	users[call.to].send({ type: 'call', action: 'inCall', with: from });
	users[from].send({ type: 'call', action: 'inCall', with: call.to });
	clearTimeout(call.timeout);
}

function rejectCall(users, from)
{
	const call = findPartner(from);

	if (call === -1)
	{
		users[from].send({ type: 'error', content: 'Call not found' });
		return ;
	}
	clearTimeout(call.timeout);
	users[call.to].send({ type: 'call', action: 'end' });
	users[from].send({ type: 'call', action: 'end' });
	usersOcupied = usersOcupied.filter(u => u != from && u != call.to);
	callInWaiting = callInWaiting.filter(c => c.from != from && c.to != call.to);
}

function endCall(users, from, to)
{
	const call = findPartner(from);

	if (call === -1)
	{
		users[from].send({ type: 'error', content: 'Call not found' });
		return ;
	}
	clearTimeout(call.timeout);
	users[call.to].send({ type: 'call', action: 'end' });
	users[from].send({ type: 'call', action: 'end' });
	usersOcupied = usersOcupied.filter(u => u != from && u != call.to);
	callInWaiting = callInWaiting.filter(c => c.from != from && c.to != call.to);
}

function sendVoiceData(users, data, from)
{
	const call = findPartner(from);

	if (call === -1)
		return;
	users[call.to].ws.send(data, { binary: true });
}

module.exports = wsCall;