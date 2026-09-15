using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;
using System.Collections.Generic;

/** A kill-on-close process container; every child is assigned while still suspended. */
public sealed class DrenvOwnedJob : IDisposable
{
    private IntPtr handle;
    private readonly Dictionary<int, IntPtr> processes = new Dictionary<int, IntPtr>();
    public DrenvOwnedJob(string name)
    {
        handle = CreateJobObject(IntPtr.Zero, name);
        if (handle == IntPtr.Zero || Marshal.GetLastWin32Error() == 183) throw new Win32Exception();
        var limits = new ExtendedLimits();
        limits.Basic.LimitFlags = 0x2000;
        int size = Marshal.SizeOf(limits);
        IntPtr buffer = Marshal.AllocHGlobal(size);
        try { Marshal.StructureToPtr(limits, buffer, false); if (!SetInformationJobObject(handle, 9, buffer, (uint)size)) throw new Win32Exception(); }
        finally { Marshal.FreeHGlobal(buffer); }
    }
    /** Spawn with inherited private environment; assignment precedes execution, including grandchildren. */
    public int Spawn(string executable, string arguments, string directory)
    {
        var startup = new StartupInfo(); startup.cb = Marshal.SizeOf(startup);
        ProcessInformation process;
        if (!CreateProcess(executable, new StringBuilder("\"" + executable + "\" " + arguments), IntPtr.Zero, IntPtr.Zero, false, 0x08000004, IntPtr.Zero, directory, ref startup, out process)) throw new Win32Exception();
        try
        {
            if (!AssignProcessToJobObject(handle, process.hProcess)) { TerminateProcess(process.hProcess, 1); throw new Win32Exception(); }
            if (ResumeThread(process.hThread) == uint.MaxValue) { TerminateProcess(process.hProcess, 1); throw new Win32Exception(); }
            processes.Add(process.dwProcessId, process.hProcess);
            return process.dwProcessId;
        }
        finally { CloseHandle(process.hThread); if (!processes.ContainsKey(process.dwProcessId)) CloseHandle(process.hProcess); }
    }
    /** Wait using the original creation handle, so fast exits cannot race PID lookup. */
    public bool IsAlive(int pid) { return WaitForSingleObject(processes[pid], 0) == 258; }
    public uint Wait(int pid) { IntPtr process = processes[pid]; if (WaitForSingleObject(process, 0xffffffff) != 0) throw new Win32Exception(); uint code; if (!GetExitCodeProcess(process, out code)) throw new Win32Exception(); return code; }
    public void Dispose() { if (handle != IntPtr.Zero) { CloseHandle(handle); handle = IntPtr.Zero; } foreach (var process in processes.Values) CloseHandle(process); processes.Clear(); }
    [DllImport("kernel32.dll", SetLastError = true)] private static extern uint WaitForSingleObject(IntPtr handle, uint milliseconds);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern bool GetExitCodeProcess(IntPtr process, out uint code);
    [StructLayout(LayoutKind.Sequential)] private struct BasicLimits { public long ProcessTime, JobTime; public uint LimitFlags; public UIntPtr MinimumWorkingSet, MaximumWorkingSet; public uint ActiveProcessLimit; public UIntPtr Affinity; public uint PriorityClass, SchedulingClass; }
    [StructLayout(LayoutKind.Sequential)] private struct IoCounters { public ulong ReadOperations, WriteOperations, OtherOperations, ReadBytes, WriteBytes, OtherBytes; }
    [StructLayout(LayoutKind.Sequential)] private struct ExtendedLimits { public BasicLimits Basic; public IoCounters Io; public UIntPtr ProcessMemory, JobMemory, PeakProcessMemory, PeakJobMemory; }
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)] private struct StartupInfo { public int cb; public string reserved, desktop, title; public int x, y, xSize, ySize, xCount, yCount, fill; public int flags; public short show, reserved2; public IntPtr reservedPointer, input, output, error; }
    [StructLayout(LayoutKind.Sequential)] private struct ProcessInformation { public IntPtr hProcess, hThread; public int dwProcessId, dwThreadId; }
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] private static extern IntPtr CreateJobObject(IntPtr attributes, string name);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern bool SetInformationJobObject(IntPtr job, int infoClass, IntPtr info, uint length);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] private static extern bool CreateProcess(string application, StringBuilder command, IntPtr processAttributes, IntPtr threadAttributes, bool inheritHandles, uint flags, IntPtr environment, string directory, ref StartupInfo startup, out ProcessInformation process);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern uint ResumeThread(IntPtr thread);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern bool TerminateProcess(IntPtr process, uint code);
    [DllImport("kernel32.dll")] private static extern bool CloseHandle(IntPtr value);
}
