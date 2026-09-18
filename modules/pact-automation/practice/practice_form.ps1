# PACT RevenU - Practice Form
# A stand-in for a PACT data-entry screen. Real WPF, so it exposes UI Automation ids
# exactly like the real client does. Run:  powershell -ExecutionPolicy Bypass -File practice\practice_form.ps1
Add-Type -AssemblyName PresentationFramework, PresentationCore, WindowsBase

[xml]$xaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="PACT RevenU - Practice Form" Height="560" Width="760"
        WindowStartupLocation="CenterScreen" Background="White" FontSize="15">
  <Grid Margin="0">
    <Grid.RowDefinitions>
      <RowDefinition Height="64"/>
      <RowDefinition Height="*"/>
      <RowDefinition Height="40"/>
    </Grid.RowDefinitions>
    <Border Grid.Row="0" Background="#1E88E5">
      <TextBlock Text="Customer Master  (practice)" Foreground="White" FontSize="24" Margin="20,14,0,0"/>
    </Border>
    <Grid Grid.Row="1" Margin="24,18,24,0">
      <Grid.ColumnDefinitions>
        <ColumnDefinition Width="150"/>
        <ColumnDefinition Width="*"/>
      </Grid.ColumnDefinitions>
      <Grid.RowDefinitions>
        <RowDefinition Height="44"/><RowDefinition Height="44"/><RowDefinition Height="44"/>
        <RowDefinition Height="44"/><RowDefinition Height="44"/><RowDefinition Height="44"/>
        <RowDefinition Height="90"/><RowDefinition Height="60"/>
      </Grid.RowDefinitions>

      <TextBlock Grid.Row="0" Text="Customer Name *" VerticalAlignment="Center"/>
      <TextBox   Grid.Row="0" Grid.Column="1" x:Name="txtCustomerName" Height="30" VerticalContentAlignment="Center"/>

      <TextBlock Grid.Row="1" Text="Phone" VerticalAlignment="Center"/>
      <TextBox   Grid.Row="1" Grid.Column="1" x:Name="txtPhone" Height="30" VerticalContentAlignment="Center"/>

      <TextBlock Grid.Row="2" Text="Email" VerticalAlignment="Center"/>
      <TextBox   Grid.Row="2" Grid.Column="1" x:Name="txtEmail" Height="30" VerticalContentAlignment="Center"/>

      <TextBlock Grid.Row="3" Text="City" VerticalAlignment="Center"/>
      <ComboBox  Grid.Row="3" Grid.Column="1" x:Name="cmbCity" Height="30" VerticalContentAlignment="Center">
        <ComboBoxItem>Mumbai</ComboBoxItem><ComboBoxItem>Pune</ComboBoxItem><ComboBoxItem>Delhi</ComboBoxItem>
        <ComboBoxItem>Bengaluru</ComboBoxItem><ComboBoxItem>Hyderabad</ComboBoxItem><ComboBoxItem>Dubai</ComboBoxItem>
      </ComboBox>

      <TextBlock Grid.Row="4" Text="Credit Limit" VerticalAlignment="Center"/>
      <TextBox   Grid.Row="4" Grid.Column="1" x:Name="txtCreditLimit" Height="30" VerticalContentAlignment="Center"/>

      <TextBlock Grid.Row="5" Text="Active" VerticalAlignment="Center"/>
      <CheckBox  Grid.Row="5" Grid.Column="1" x:Name="chkActive" VerticalAlignment="Center" Content="Customer is active"/>

      <TextBlock Grid.Row="6" Text="Notes" VerticalAlignment="Top" Margin="0,8,0,0"/>
      <TextBox   Grid.Row="6" Grid.Column="1" x:Name="txtNotes" Height="76" AcceptsReturn="True" TextWrapping="Wrap" VerticalScrollBarVisibility="Auto"/>

      <StackPanel Grid.Row="7" Grid.Column="1" Orientation="Horizontal" HorizontalAlignment="Right" Margin="0,10,0,0">
        <Button x:Name="btnNew"  Content="New"  Width="110" Height="36" Margin="0,0,12,0"/>
        <Button x:Name="btnSave" Content="Save" Width="110" Height="36" Background="#1E88E5" Foreground="White" FontWeight="Bold"/>
      </StackPanel>
    </Grid>
    <Border Grid.Row="2" Background="#F2F2F2" BorderBrush="#DDDDDD" BorderThickness="0,1,0,0">
      <TextBlock x:Name="lblStatus" Text="Ready" Margin="16,0,0,0" VerticalAlignment="Center" Foreground="#333333"/>
    </Border>
  </Grid>
</Window>
"@

$reader = New-Object System.Xml.XmlNodeReader $xaml
$win = [Windows.Markup.XamlReader]::Load($reader)
$c = @{}
foreach ($n in 'txtCustomerName','txtPhone','txtEmail','cmbCity','txtCreditLimit','chkActive','txtNotes','btnNew','btnSave','lblStatus') { $c[$n] = $win.FindName($n) }

$savedFile = Join-Path $PSScriptRoot 'saved_records.csv'
if (-not (Test-Path $savedFile)) { 'record_id,customer_name,phone,email,city,credit_limit,active,notes,saved_at' | Set-Content $savedFile -Encoding UTF8 }
$script:counter = (Get-Content $savedFile | Measure-Object -Line).Lines - 1

$c.btnNew.Add_Click({
  foreach ($n in 'txtCustomerName','txtPhone','txtEmail','txtCreditLimit','txtNotes') { $c[$n].Text = '' }
  $c.cmbCity.SelectedIndex = -1; $c.chkActive.IsChecked = $false
  $c.lblStatus.Text = 'Ready'; $c.lblStatus.Foreground = '#333333'
})

$c.btnSave.Add_Click({
  if ([string]::IsNullOrWhiteSpace($c.txtCustomerName.Text)) {
    $c.lblStatus.Text = 'Error: Customer Name is required'; $c.lblStatus.Foreground = '#C62828'; return
  }
  if ($c.txtCreditLimit.Text -ne '' -and -not ($c.txtCreditLimit.Text -match '^\d+(\.\d+)?$')) {
    $c.lblStatus.Text = 'Error: Credit Limit must be a number'; $c.lblStatus.Foreground = '#C62828'; return
  }
  $script:counter++
  $id = 'CUST-{0:D4}' -f $script:counter
  $city = if ($c.cmbCity.SelectedItem) { $c.cmbCity.SelectedItem.Content } else { '' }
  $q = { param($s) '"' + ($s -replace '"','""') + '"' }
  $row = @($id, (& $q $c.txtCustomerName.Text), (& $q $c.txtPhone.Text), (& $q $c.txtEmail.Text), (& $q $city),
           (& $q $c.txtCreditLimit.Text), $c.chkActive.IsChecked, (& $q $c.txtNotes.Text), (Get-Date -Format 's')) -join ','
  Add-Content $savedFile $row -Encoding UTF8
  $c.lblStatus.Text = "Saved: $id"; $c.lblStatus.Foreground = '#2E7D32'
})

$win.Add_Loaded({ $c.txtCustomerName.Focus() | Out-Null })
$win.ShowDialog() | Out-Null
