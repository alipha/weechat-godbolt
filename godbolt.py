import weechat
import subprocess

current_dir = "/home/alipha/repos/weechat-godbolt"
snippets = {}           # snippets[channel][nick] == "last geordi command"
channel_snippets = {}   # last snippet in the channel
nick_snippets = {}      # last snippet by nick


def get_snippet(channel, nick):
    if channel in snippets and nick in snippets[channel]:
        return snippets[channel][nick]
    else:
        return None


def get_channel_snippet(channel):
    if channel in channel_snippets:
        return channel_snippets[channel]
    else:
        return None, None


def get_nick_snippet(nick):
    if nick in nick_snippets:
        return nick_snippets[nick]
    else:
        return None


def send_message(servername, channel, message):
    weechat.hook_signal_send("irc_input_send", weechat.WEECHAT_HOOK_SIGNAL_STRING, servername + ';' + channel + ';priority_high,user_message;;' + message)


def make_snippet(snippet):
    return subprocess.run(["nodejs", current_dir + "/godbolt.js"], input=snippet, capture_output=True, text=True).stdout 


def godbolt_message(restricted, nick, snippet):
    url = make_snippet(snippet)
    if restricted:
        return nick + ": please use godbolt.org for all but the most trivial snippets. here, I did it for you, this one time: " + url
    else:
        return nick + ": " + url


def deny_message(servername, channel, nick):
    send_message(servername, channel, nick + ": no. you're not going to create a geordi snippet and then use my irc script to upload it to godbolt. just go to godbolt yourself")


def run_cmd(data, buf, args):
    buffer = weechat.current_buffer()
    #weechat.prnt(buffer, weechat.buffer_get_string(buf, "localvar_channel"))
    cmd = args.strip()
    if cmd.find(" ") != -1:
        weechat.prnt(buffer, make_snippet(cmd));
    elif cmd:
        #channel = weechat.buffer_get_string(buffer, "localvar_channel")
        #weechat.prnt(buffer, "channel: '" + channel + "'")
        #weechat.prnt(buffer, "nick: '" + cmd + "'")
        #snippet = get_snippet(channel, cmd)     # cmd is the nick
        snippet = get_nick_snippet(cmd)
        if snippet:
            weechat.prnt(buffer, godbolt_message(True, cmd, snippet))
        else:
            weechat.prnt(buffer, cmd + " had no previous geordi snippet")
    else:
        channel = weechat.buffer_get_string(buffer, "localvar_channel")
        #weechat.prnt(buffer, "channel: " + channel)
        nick, snippet = get_channel_snippet(channel)
        if snippet:
            weechat.prnt(buffer, godbolt_message(True, nick, snippet))
        else:
            weechat.prnt(buffer, channel + " had no previous geordi snippet")      
    return weechat.WEECHAT_RC_OK


def run_privmsg(data, msgtype, servername, args):
    hostmask, chanmsg = str.split(args, "PRIVMSG ", 1)
    hostname = ""
    nick = hostmask
    if hostmask.find("!") != -1:
        nick, hostname = str.split(hostmask, "!", 1)
   
    nick = nick[1:]
    if nick == 'geordi':
        return args

    channel, message = str.split(chanmsg, " :", 1)
    buffer = weechat.info_get("irc_buffer", servername + ',' + channel)
    
    #weechat.prnt(buffer, "run_privmsg: " + message)
    message = message.strip()

    restricted = (channel.lower().find("c++") != -1)
    """
    if message.startswith(".godbolt"):
        target = message[9:].strip()
        if target.startswith("{") or target.startswith("<<") or target.find(" ") != -1:
            if restricted:
                send_message(servername, channel, nick + ": creating snippets are only allowed in #geordi")
            else:
                send_message(servername, channel, nick + ": " + make_snippet(target))
        if restricted and nick == target:
            deny_message(servername, channel, nick)
        elif target:
            snippet = get_snippet(channel, target)
            if snippet:
                send_message(servername, channel, godbolt_message(restricted, target, snippet))
            #else:
            #    send_message(servername, channel, nick + ": no godbolt snippet found for that nick")
        else:
            target, snippet = get_channel_snippet(channel)
            if restricted and nick == target:
                deny_message(servername, channel, nick)
            elif snippet:
                send_message(servername, channel, godbolt_message(restricted, target, snippet))
            #else:
            #    send_message(servername, channel, nick + ": no godbolt snippet found in this channel")
    """
    if message.startswith("{") or message.startswith("<<") or message.startswith("geordi:") or message.startswith("geordi,"):
        channel_snippets[channel] = nick, message
        if channel not in snippets:
            #weechat.prnt(buffer, "adding channel: '" + channel + "'")
            snippets[channel] = {}
        #weechat.prnt(buffer, "adding '" + nick + "' to '" + channel + "' snippets")
        snippets[channel][nick] = message
        nick_snippets[nick] = message

    #url = subprocess.run(["nodejs", current_dir + "/godbolt.js"], input=message[9:], capture_output=True, text=True).stdout
    #weechat.prnt(buffer, url)
    return args


weechat.register("godbolt", "Alipha", "0.1", "GPL3", "Create godbolt link", "", "")
weechat.hook_command("godbolt", "Create a godbolt link from a geordi-style c++ snippet", "[code]", "", "", "run_cmd", "")
weechat.hook_modifier("irc_in_privmsg", "run_privmsg", "")

